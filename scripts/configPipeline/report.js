import fs from "fs";
import path from "path";

export const buildReport = ({
  mode,
  strict,
  status,
  env,
  code,
  toml,
  whitelist,
  issues,
  writerOutput,
  envUpdates,
}) => {
  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;

  return {
    tool: "configPipeline",
    generatedAt: new Date().toISOString(),
    mode,
    strict,
    status,
    exitCode: errors > 0 ? 1 : 0,
    facts: {
      env: {
        file: env.file,
        exists: env.exists,
        missing: env.missing,
        scopes: env.facts.scopes.list.map((scope) => ({
          value: scope,
          line: env.facts.scopes.line,
        })),
        appUrl: env.facts.appUrl,
        apiKey: env.facts.apiKey,
        apiSecret: env.facts.apiSecret,
      },
      routes: code.routes,
      webhooks: code.webhooks,
    },
    toml,
    whitelist: {
      file: whitelist.file,
      exists: whitelist.exists,
      count: whitelist.topics.size,
    },
    issues,
    writerOutput: writerOutput || null,
    envUpdates: envUpdates || [],
    summary: { errors, warnings },
  };
};

const formatSource = (source) =>
  source.line ? `${source.file}:${source.line}` : source.file;

export const renderHuman = (report) => {
  const lines = [];
  lines.push("== Shopify Config Pipeline ==");
  lines.push(
    `mode: ${report.mode} | strict: ${report.strict} | status: ${report.status} | exit: ${report.exitCode}`
  );
  lines.push(`generatedAt: ${report.generatedAt}`);
  lines.push("");

  lines.push("Facts");
  const env = report.facts.env;
  if (!env.exists) {
    lines.push("  env: .env not found (degraded)");
  } else {
    lines.push(`  env (${env.file}):`);
    lines.push(
      `    SHOPIFY_API_SCOPES  line ${env.scopes[0]?.line ?? "-"}   ${env.scopes
        .map((scope) => scope.value)
        .join(",")}`
    );
    lines.push(
      `    SHOPIFY_APP_URL     line ${env.appUrl.line ?? "-"}   ${env.appUrl.value}`
    );
    lines.push(
      `    SHOPIFY_API_KEY     line ${env.apiKey.line ?? "-"}   ${env.apiKey.value}`
    );
    lines.push(
      `    SHOPIFY_API_SECRET  line ${env.apiSecret.line ?? "-"}   ${env.apiSecret.masked} (masked)`
    );
    if (env.missing.length > 0) {
      lines.push(`    missing fields: ${env.missing.join(", ")}`);
    }
  }
  lines.push(`  routes (server/): ${report.facts.routes.length} registered`);
  for (const route of report.facts.routes) {
    lines.push(
      `    ${route.method.padEnd(6)} ${route.path.padEnd(32)} ${route.file}:${route.line}`
    );
  }
  lines.push("  webhooks:");
  for (const entry of report.facts.webhooks.registered) {
    lines.push(
      `    ${entry.topics.join(", ")} -> ${entry.url}  ${entry.file}:${entry.line}`
    );
  }
  for (const handler of report.facts.webhooks.handlers) {
    lines.push(
      `    handler case ${handler.topic}  ${handler.file}:${handler.line}`
    );
  }
  lines.push(
    `  whitelist: ${report.whitelist.count} topics (${report.whitelist.file})`
  );
  lines.push("");

  if (report.toml.exists) {
    lines.push("Toml (shopify.app.toml)");
    lines.push(
      `  scopes           line ${report.toml.scopes.line ?? "-"}   ${report.toml.scopes.list.join(",")}`
    );
    lines.push(
      `  application_url  line ${report.toml.applicationUrl.line ?? "-"}   ${report.toml.applicationUrl.value}`
    );
    for (const subscription of report.toml.subscriptions) {
      lines.push(
        `  subscription     line ${subscription.line ?? "-"}   ${subscription.topics.join(",")} -> ${subscription.uri}`
      );
    }
    lines.push("");
  }

  if (report.envUpdates.length > 0) {
    lines.push("Env updates (--from-toml)");
    for (const update of report.envUpdates) {
      lines.push(
        `  ${update.key}  .env:${update.line}  ${update.previous} -> ${update.value}`
      );
    }
    lines.push("");
  }

  lines.push(
    `Issues (${report.summary.errors} error(s), ${report.summary.warnings} warning(s))`
  );
  if (report.issues.length === 0) {
    lines.push("  none");
  }
  for (const item of report.issues) {
    const tag = item.severity === "error" ? "ERROR" : "WARN ";
    lines.push(`  [${tag}] ${item.code}  ${item.message}`);
    if (item.expected !== null) {
      lines.push(`         expected: ${item.expected}`);
    }
    if (item.actual !== null) {
      lines.push(`         actual:   ${item.actual}`);
    }
    for (const source of item.sources) {
      lines.push(`         source:   ${formatSource(source)}`);
    }
  }

  return lines.join("\n") + "\n";
};

export const writeReport = (root, report) => {
  const json = JSON.stringify(report, null, 2) + "\n";
  const human = renderHuman(report);

  const evidenceDir = path.join(root, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "config-report.json"), json);
  fs.writeFileSync(path.join(evidenceDir, "config-report.txt"), human);

  const publicDir = path.join(root, "client", "public", "debug");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "config-report.json"), json);

  return { json, human };
};

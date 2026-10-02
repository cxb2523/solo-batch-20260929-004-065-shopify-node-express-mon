import fs from "fs";
import path from "path";
import { REPORT_JSON, ROOT } from "./paths.js";

function rel(file) {
  return file ? path.relative(ROOT, file).replace(/\\/g, "/") : null;
}

function formatSource(src) {
  if (!src || !src.file) return "<unknown>";
  return src.line ? `${src.file}:${src.line}` : src.file;
}

/**
 * Build the report object. `human` is the human-readable rendering of the
 * same data; the CLI prints it and the debug page renders it, so both
 * surfaces always come from this one JSON document.
 */
export function buildReport({
  mode,
  strict,
  envFacts,
  codeFacts,
  tomlFacts,
  drift,
  warnings,
  actions,
  status,
}) {
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    strict,
    status,
    summary: {
      driftCount: drift.length,
      warningCount: warnings.length,
      envFilePresent: envFacts.envFilePresent,
      tomlPresent: tomlFacts.tomlPresent,
      missingEnvFields: envFacts.missing.map((m) => m.field),
    },
    env: {
      fields: Object.fromEntries(
        Object.entries(envFacts.fields).map(([field, info]) => [
          field,
          info.present
            ? {
                present: true,
                key: info.key,
                value: info.display,
                source: { file: rel(info.file), line: info.line },
              }
            : { present: false, keys: info.keys },
        ])
      ),
      scopes: envFacts.scopes,
    },
    code: {
      routeCount: codeFacts.routes.length,
      routes: codeFacts.routes.map((route) => ({
        method: route.method,
        path: route.path,
        source: { file: rel(route.file), line: route.line },
      })),
      webhookTopics: codeFacts.webhookTopics,
      webhooks: codeFacts.webhooks.map((webhook) => ({
        topics: webhook.topics,
        url: webhook.url,
        source: { file: rel(webhook.file), line: webhook.topicsLine },
      })),
      whitelistSize: codeFacts.whitelistSize,
    },
    toml: {
      scopes: tomlFacts.scopes,
      applicationUrl: tomlFacts.applicationUrl,
      webhookTopics: tomlFacts.webhookTopics,
    },
    drift,
    warnings,
    actions,
    human: [],
  };
  report.human = renderHuman(report);
  return report;
}

function renderHuman(report) {
  const lines = [];
  lines.push(`Config pipeline report (${report.generatedAt})`);
  lines.push(`Mode: ${report.mode}${report.strict ? " [strict]" : ""}`);
  lines.push(`Status: ${report.status.toUpperCase()}`);
  lines.push("");
  lines.push("== Env facts ==");
  if (!report.summary.envFilePresent) {
    lines.push("  .env: <missing>");
  }
  for (const [field, info] of Object.entries(report.env.fields)) {
    if (info.present) {
      const src = formatSource(info.source);
      lines.push(`  ${field} (${info.key}) = ${info.value}  [${src}]`);
    } else {
      lines.push(`  ${field}: MISSING (looked for ${info.keys.join(" / ")})`);
    }
  }
  lines.push("");
  lines.push("== Code facts ==");
  lines.push(`  Express routes registered: ${report.code.routeCount}`);
  for (const route of report.code.routes) {
    lines.push(
      `    ${route.method.padEnd(6)} ${route.path}  [${formatSource(route.source)}]`
    );
  }
  lines.push(
    `  Webhook topics in code: ${report.code.webhookTopics.join(", ") || "<none>"}`
  );
  lines.push(`  Whitelist topics available: ${report.code.whitelistSize}`);
  lines.push("");
  lines.push("== TOML facts ==");
  if (!report.summary.tomlPresent) {
    lines.push("  shopify.app.toml: <missing>");
  } else {
    lines.push(`  scopes: ${report.toml.scopes.join(", ") || "<none>"}`);
    lines.push(
      `  application_url: ${report.toml.applicationUrl ?? "<missing>"}`
    );
    lines.push(
      `  webhook topics: ${report.toml.webhookTopics.join(", ") || "<none>"}`
    );
  }
  if (report.actions.length > 0) {
    lines.push("");
    lines.push("== Actions ==");
    for (const action of report.actions) lines.push(`  ${action}`);
  }
  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("== Warnings ==");
    for (const warning of report.warnings) lines.push(`  ${warning}`);
  }
  lines.push("");
  lines.push(`== Drift (${report.drift.length}) ==`);
  if (report.drift.length === 0) {
    lines.push("  none");
  }
  report.drift.forEach((item, index) => {
    lines.push(`  ${index + 1}. [${item.kind}] ${item.message}`);
    lines.push(`     expected: ${item.expected}`);
    lines.push(`     actual:   ${item.actual}`);
    for (const src of item.sources) {
      lines.push(`     source:   ${formatSource(src)}`);
    }
  });
  return lines;
}

export function writeReport(report) {
  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");
  return REPORT_JSON;
}

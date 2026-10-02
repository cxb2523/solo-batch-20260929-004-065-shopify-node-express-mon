import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractRouteFacts, extractWebhookFacts } from "./codeFacts.js";
import { diffConfig } from "./diff.js";
import { extractEnvFacts } from "./envFacts.js";
import { buildReport, writeReport } from "./report.js";
import { extractTomlFacts } from "./tomlFacts.js";
import { loadWebhookTopicWhitelist } from "./whitelist.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const args = process.argv.slice(2);
const mode = args.includes("--from-toml")
  ? "from-toml"
  : args.includes("--verify")
    ? "verify"
    : "write";
const strict = args.includes("--strict") || Boolean(process.env.CI);

const warningIssue = (code, message) => ({
  severity: strict ? "error" : "warning",
  code,
  message,
  expected: null,
  actual: null,
  sources: [{ file: ".env", line: null }],
});

const runTomlWriter = (env) => {
  const childEnv = { ...process.env };
  for (const [key, entry] of Object.entries(env.vars)) {
    childEnv[key] = entry.value;
  }
  const result = spawnSync(
    process.execPath,
    [path.join(root, "_developer", "tomlWriter.js")],
    { cwd: root, env: childEnv, encoding: "utf8" }
  );
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
};

const applyEnvUpdates = (updates) => {
  const envPath = path.join(root, ".env");
  const lines = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    : [];
  const applied = [];

  for (const { key, value } of updates) {
    const index = lines.findIndex((line) =>
      new RegExp(`^\\s*${key}\\s*=`).test(line)
    );
    if (index >= 0) {
      const previous = lines[index].split("=").slice(1).join("=").trim();
      lines[index] = `${key}=${value}`;
      applied.push({ key, value, previous, line: index + 1 });
    } else {
      lines.push(`${key}=${value}`);
      applied.push({ key, value, previous: "(absent)", line: lines.length });
    }
  }

  fs.writeFileSync(envPath, lines.join("\n"));
  return applied;
};

const main = () => {
  const issues = [];
  let writerOutput = null;
  let envUpdates = [];

  let env = extractEnvFacts(root);
  const code = {
    routes: extractRouteFacts(root),
    webhooks: extractWebhookFacts(root),
  };
  const whitelist = loadWebhookTopicWhitelist(root);

  if (!env.exists) {
    issues.push(
      warningIssue(
        "env.missing",
        ".env file not found; config pipeline degraded to warning-only mode"
      )
    );
  } else if (env.missing.length > 0) {
    issues.push(
      warningIssue(
        "env.fields_missing",
        `required .env fields missing or empty: ${env.missing.join(", ")}`
      )
    );
  }

  const degraded = issues.length > 0;

  if (degraded) {
    if (mode === "from-toml" && strict) {
      // fall through to hard failure below
    }
    const toml = extractTomlFacts(root);
    const status = strict ? "error" : "degraded";
    const report = buildReport({
      mode,
      strict,
      status,
      env,
      code,
      toml,
      whitelist,
      issues,
    });
    if (!strict) {
      report.exitCode = 0;
    }
    const { human } = writeReport(root, report);
    process.stdout.write(human);
    process.exit(report.exitCode);
  }

  if (mode === "from-toml") {
    const toml = extractTomlFacts(root);
    if (!toml.exists) {
      issues.push({
        severity: "error",
        code: "toml.missing",
        message: "cannot run --from-toml: shopify.app.toml does not exist",
        expected: "shopify.app.toml",
        actual: "file missing",
        sources: [{ file: "shopify.app.toml", line: null }],
      });
    } else {
      envUpdates = applyEnvUpdates([
        { key: "SHOPIFY_API_SCOPES", value: toml.scopes.list.join(",") },
        { key: "SHOPIFY_APP_URL", value: toml.applicationUrl.value },
        { key: "SHOPIFY_API_KEY", value: toml.clientId.value },
      ]);
      issues.push({
        severity: "warning",
        code: "env.secret_not_recoverable",
        message:
          "SHOPIFY_API_SECRET cannot be recovered from shopify.app.toml; set it manually in .env",
        expected: null,
        actual: null,
        sources: [{ file: ".env", line: null }],
      });
      env = extractEnvFacts(root);
      issues.push(...diffConfig({ env, code, toml, whitelist, strict }));
    }

    const report = buildReport({
      mode,
      strict,
      status: issues.some((item) => item.severity === "error") ? "drift" : "ok",
      env,
      code,
      toml,
      whitelist,
      issues,
      envUpdates,
    });
    const { human } = writeReport(root, report);
    process.stdout.write(human);
    process.exit(report.exitCode);
  }

  if (mode === "write") {
    writerOutput = runTomlWriter(env);
    if (writerOutput.status !== 0) {
      issues.push({
        severity: "error",
        code: "writer.failed",
        message: `_developer/tomlWriter.js exited with code ${writerOutput.status}`,
        expected: "exit code 0",
        actual: String(writerOutput.status),
        sources: [{ file: "_developer/tomlWriter.js", line: null }],
      });
    }
  }

  const toml = extractTomlFacts(root);
  issues.push(...diffConfig({ env, code, toml, whitelist, strict }));

  const hasErrors = issues.some((item) => item.severity === "error");
  const report = buildReport({
    mode,
    strict,
    status: hasErrors ? "drift" : "ok",
    env,
    code,
    toml,
    whitelist,
    issues,
    writerOutput,
  });
  const { human } = writeReport(root, report);
  process.stdout.write(human);
  process.exit(report.exitCode);
};

main();

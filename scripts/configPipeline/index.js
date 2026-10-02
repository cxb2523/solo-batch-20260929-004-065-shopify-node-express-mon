#!/usr/bin/env node
import { collectEnvFacts } from "./envFacts.js";
import { collectCodeFacts } from "./codeFacts.js";
import { collectTomlFacts } from "./tomlFacts.js";
import { computeDrift } from "./diff.js";
import { buildReport, writeReport } from "./report.js";
import { backfillEnvFromToml, regenerateTomlFromEnv } from "./sync.js";

const args = new Set(process.argv.slice(2));
const isVerify = args.has("--verify");
const isFromToml = args.has("--from-toml");
const strict = args.has("--strict") || Boolean(process.env.CI);
const mode = isFromToml ? "from-toml" : isVerify ? "verify" : "sync";

const warnings = [];
const actions = [];

function collectAll() {
  return {
    envFacts: collectEnvFacts(),
    codeFacts: collectCodeFacts(),
    tomlFacts: collectTomlFacts(),
  };
}

function envWarnings(envFacts) {
  const out = [];
  if (!envFacts.envFilePresent) {
    out.push(
      ".env is missing; env-dependent checks degraded to warnings (copy .env.example to .env)"
    );
  } else {
    for (const missing of envFacts.missing) {
      out.push(
        `env field "${missing.field}" is missing (looked for ${missing.keys.join(" / ")})`
      );
    }
  }
  return out;
}

function finalize({ envFacts, codeFacts, tomlFacts, drift, failed }) {
  const status = failed ? "fail" : drift.length > 0 ? "drift" : "ok";
  const report = buildReport({
    mode,
    strict,
    envFacts,
    codeFacts,
    tomlFacts,
    drift,
    warnings,
    actions,
    status,
  });
  const reportPath = writeReport(report);
  console.log(report.human.join("\n"));
  console.log(`\nReport JSON written to ${reportPath}`);
  process.exit(failed || drift.length > 0 ? 1 : 0);
}

function run() {
  let { envFacts, codeFacts, tomlFacts } = collectAll();
  warnings.push(...envWarnings(envFacts));

  const envIncomplete = !envFacts.envFilePresent || envFacts.missing.length > 0;
  if (envIncomplete && strict) {
    const { drift } = computeDrift({ envFacts, codeFacts, tomlFacts });
    finalize({ envFacts, codeFacts, tomlFacts, drift, failed: true });
    return;
  }

  if (isFromToml) {
    if (!tomlFacts.tomlPresent) {
      warnings.push("--from-toml requested but shopify.app.toml is missing");
      finalize({ envFacts, codeFacts, tomlFacts, drift: [], failed: strict });
      return;
    }
    const diffs = backfillEnvFromToml(tomlFacts);
    actions.push(
      diffs.length > 0
        ? `Backfilled .env from shopify.app.toml:`
        : ".env already matches shopify.app.toml; nothing to backfill"
    );
    for (const diff of diffs) actions.push(`  ${diff}`);
    ({ envFacts, codeFacts, tomlFacts } = collectAll());
  } else if (!isVerify && !envIncomplete) {
    // Default: env + code routes are the single source of truth.
    regenerateTomlFromEnv();
    actions.push(
      "Regenerated shopify.app.toml via _developer/tomlWriter.js + webhookWriter.js"
    );
    ({ envFacts, codeFacts, tomlFacts } = collectAll());
  } else if (!isVerify && envIncomplete) {
    warnings.push(
      "Skipped shopify.app.toml regeneration because env facts are incomplete"
    );
  }

  const { drift } = computeDrift({ envFacts, codeFacts, tomlFacts });
  const failed = strict && (drift.length > 0 || envIncomplete);
  finalize({ envFacts, codeFacts, tomlFacts, drift, failed });
}

run();

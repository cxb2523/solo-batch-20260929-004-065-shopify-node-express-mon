import path from "path";
import { ROOT } from "./paths.js";

function rel(file) {
  return file ? path.relative(ROOT, file).replace(/\\/g, "/") : null;
}

function source(file, line) {
  return { file: rel(file), line: line ?? null };
}

function setDiff(expected, actual) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    extra: actual.filter((item) => !expectedSet.has(item)),
  };
}

/**
 * Bidirectional drift check between env+code facts (source of truth)
 * and shopify.app.toml facts.
 */
export function computeDrift({ envFacts, codeFacts, tomlFacts }) {
  const drift = [];
  const envReady = envFacts.envFilePresent && envFacts.missing.length === 0;

  if (!tomlFacts.tomlPresent) {
    if (envReady) {
      drift.push({
        kind: "toml-missing",
        message: "shopify.app.toml is missing but env facts are complete",
        expected: "shopify.app.toml generated from .env + code",
        actual: "<missing>",
        sources: [source("shopify.app.toml", null)],
      });
    }
    return { drift, envReady };
  }

  if (tomlFacts.parseError) {
    drift.push({
      kind: "toml-parse-error",
      message: `shopify.app.toml failed to parse: ${tomlFacts.parseError}`,
      expected: "valid TOML",
      actual: tomlFacts.parseError,
      sources: [source("shopify.app.toml", null)],
    });
    return { drift, envReady };
  }

  if (envReady) {
    const scopeDiff = setDiff(envFacts.scopes, tomlFacts.scopes);
    for (const scope of scopeDiff.missing) {
      drift.push({
        kind: "scope-missing-in-toml",
        message: `Scope "${scope}" is declared in .env but missing in shopify.app.toml`,
        expected: scope,
        actual: tomlFacts.scopes.join(","),
        sources: [
          source(envFacts.fields.scopes.file, envFacts.fields.scopes.line),
          source("shopify.app.toml", tomlFacts.lines.scopes),
        ],
      });
    }
    for (const scope of scopeDiff.extra) {
      drift.push({
        kind: "scope-extra-in-toml",
        message: `Scope "${scope}" is in shopify.app.toml but not declared in .env`,
        expected: envFacts.scopes.join(","),
        actual: scope,
        sources: [
          source("shopify.app.toml", tomlFacts.lines.scopes),
          source(envFacts.fields.scopes.file, envFacts.fields.scopes.line),
        ],
      });
    }

    if (envFacts.appUrl !== tomlFacts.applicationUrl) {
      drift.push({
        kind: "application-url-mismatch",
        message: "application_url differs between .env and shopify.app.toml",
        expected: envFacts.appUrl,
        actual: tomlFacts.applicationUrl ?? "<missing>",
        sources: [
          source(envFacts.fields.appUrl.file, envFacts.fields.appUrl.line),
          source("shopify.app.toml", tomlFacts.lines.applicationUrl),
        ],
      });
    }

    if (envFacts.apiKey && tomlFacts.clientId !== envFacts.apiKey) {
      drift.push({
        kind: "client-id-mismatch",
        message:
          "client_id in shopify.app.toml differs from the API key in .env",
        expected: envFacts.apiKey,
        actual: tomlFacts.clientId ?? "<missing>",
        sources: [
          source(envFacts.fields.apiKey.file, envFacts.fields.apiKey.line),
          source("shopify.app.toml", tomlFacts.lines.clientId),
        ],
      });
    }
  }

  const topicDiff = setDiff(codeFacts.webhookTopics, tomlFacts.webhookTopics);
  const firstCodeWebhook = codeFacts.webhooks[0];
  for (const topic of topicDiff.missing) {
    const declared = codeFacts.webhooks.find((w) => w.topics.includes(topic));
    drift.push({
      kind: "webhook-missing-in-toml",
      message: `Webhook topic "${topic}" is registered in code but missing in shopify.app.toml`,
      expected: topic,
      actual: tomlFacts.webhookTopics.join(","),
      sources: [
        source(declared?.file ?? firstCodeWebhook?.file, declared?.topicsLine),
        source("shopify.app.toml", tomlFacts.lines.webhookTopics[0] ?? null),
      ],
    });
  }
  for (const topic of topicDiff.extra) {
    drift.push({
      kind: "webhook-extra-in-toml",
      message: `Webhook topic "${topic}" is in shopify.app.toml but not registered in code`,
      expected: codeFacts.webhookTopics.join(","),
      actual: topic,
      sources: [
        source("shopify.app.toml", tomlFacts.lines.webhookTopics[0] ?? null),
        source(firstCodeWebhook?.file, firstCodeWebhook?.topicsLine),
      ],
    });
  }

  for (const unknown of codeFacts.unknownTopics) {
    drift.push({
      kind: "webhook-unknown-topic",
      message: `Webhook topic "${unknown.topic}" is not in the _developer/types/webhookTopics.js whitelist`,
      expected: "a topic from _developer/types/webhookTopics.js",
      actual: unknown.topic,
      sources: [source(unknown.file, unknown.line)],
    });
  }

  return { drift, envReady };
}

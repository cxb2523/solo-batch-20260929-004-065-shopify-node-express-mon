import toml from "@iarna/toml";
import fs from "fs";
import { TOML_FILE } from "./paths.js";
import { normalizeScopes, normalizeUrl } from "./envFacts.js";

function findLine(lines, pattern) {
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? null : index + 1;
}

/**
 * Extract facts from shopify.app.toml: scopes, application_url, client_id
 * and webhook subscription topics, each with 1-based line numbers.
 */
export function collectTomlFacts(tomlFile = TOML_FILE) {
  const facts = {
    tomlPresent: fs.existsSync(tomlFile),
    scopes: [],
    applicationUrl: null,
    clientId: null,
    webhookTopics: [],
    lines: {},
    parseError: null,
  };
  if (!facts.tomlPresent) return facts;

  const raw = fs.readFileSync(tomlFile, "utf8");
  const lines = raw.split(/\r?\n/);

  let parsed;
  try {
    parsed = toml.parse(raw);
  } catch (error) {
    facts.parseError = error.message;
    return facts;
  }

  const scopesRaw = parsed?.access_scopes?.scopes;
  facts.scopes = normalizeScopes(
    Array.isArray(scopesRaw) ? scopesRaw.join(",") : scopesRaw
  );
  facts.applicationUrl = normalizeUrl(parsed?.application_url);
  facts.clientId = parsed?.client_id ?? null;

  const subscriptions = parsed?.webhooks?.subscriptions;
  if (Array.isArray(subscriptions)) {
    for (const subscription of subscriptions) {
      const topics = Array.isArray(subscription.topics)
        ? subscription.topics
        : [subscription.topics].filter(Boolean);
      facts.webhookTopics.push(...topics);
    }
  }
  facts.webhookTopics = [...new Set(facts.webhookTopics)].sort();

  facts.lines.scopes = findLine(lines, /^\s*scopes\s*=/);
  facts.lines.applicationUrl = findLine(lines, /^\s*application_url\s*=/);
  facts.lines.clientId = findLine(lines, /^\s*client_id\s*=/);
  facts.lines.webhookTopics = [];
  lines.forEach((line, index) => {
    if (/^\s*topics\s*=\s*\[/.test(line)) {
      facts.lines.webhookTopics.push(index + 1);
    }
  });
  return facts;
}

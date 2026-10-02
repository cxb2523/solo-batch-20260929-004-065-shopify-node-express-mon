import fs from "fs";
import { ENV_FILE } from "./paths.js";
import { displayValue } from "./mask.js";

/**
 * Logical fact -> candidate env keys, in priority order.
 * The repo convention is SHOPIFY_*; short aliases are accepted as fallback.
 */
const FIELD_KEYS = {
  scopes: ["SHOPIFY_API_SCOPES", "SCOPES"],
  appUrl: ["SHOPIFY_APP_URL", "APP_URL"],
  apiKey: ["SHOPIFY_API_KEY", "API_KEY"],
  apiSecret: ["SHOPIFY_API_SECRET", "API_SECRET"],
};

export const REQUIRED_FIELDS = Object.keys(FIELD_KEYS);

/** Parse a dotenv-style file, preserving 1-based line numbers. */
export function parseEnvFile(filePath = ENV_FILE) {
  if (!fs.existsSync(filePath)) return null;
  const entries = new Map();
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/
    );
    if (!match) return;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.set(key, { key, value, line: index + 1, file: filePath });
  });
  return entries;
}

export function normalizeScopes(raw) {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean)
    ),
  ].sort();
}

export function normalizeUrl(raw) {
  if (!raw) return null;
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Extract env facts. Never includes raw secret values in the returned object;
 * secrets are exposed only as a sha256:xxxxxxxx mask.
 */
export function collectEnvFacts() {
  const entries = parseEnvFile();
  const facts = {
    envFilePresent: entries !== null,
    fields: {},
    missing: [],
    scopes: [],
    appUrl: null,
    apiKey: null,
    apiSecretMasked: null,
  };
  if (!entries) return facts;

  for (const [field, keys] of Object.entries(FIELD_KEYS)) {
    const hit = keys
      .map((key) => entries.get(key))
      .find((entry) => entry && entry.value.trim().length > 0);
    if (!hit) {
      facts.missing.push({ field, keys });
      facts.fields[field] = { present: false, keys };
      continue;
    }
    facts.fields[field] = {
      present: true,
      key: hit.key,
      file: hit.file,
      line: hit.line,
      display: displayValue(hit.key, hit.value),
    };
    if (field === "scopes") facts.scopes = normalizeScopes(hit.value);
    if (field === "appUrl") facts.appUrl = normalizeUrl(hit.value);
    if (field === "apiKey") facts.apiKey = hit.value.trim();
    if (field === "apiSecret")
      facts.apiSecretMasked = displayValue(hit.key, hit.value);
    // Raw secret is intentionally not stored on the facts object.
  }
  return facts;
}

/** Raw accessor for writers only (never logged). */
export function readRawEnvValue(field) {
  const entries = parseEnvFile();
  if (!entries) return null;
  for (const key of FIELD_KEYS[field] || []) {
    const hit = entries.get(key);
    if (hit && hit.value.trim().length > 0) return hit;
  }
  return null;
}

export { FIELD_KEYS };

import { execFileSync } from "child_process";
import fs from "fs";
import { ENV_FILE, TOML_WRITER } from "./paths.js";
import { FIELD_KEYS, parseEnvFile } from "./envFacts.js";

/**
 * Regenerate shopify.app.toml by driving the existing repo writers
 * (_developer/tomlWriter.js, which internally runs webhookWriter.js).
 */
export function regenerateTomlFromEnv() {
  execFileSync(process.execPath, [TOML_WRITER], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
}

const TOML_TO_FIELD = {
  scopes: "scopes",
  application_url: "appUrl",
  client_id: "apiKey",
};

/**
 * Reverse direction: use shopify.app.toml as source of truth and backfill
 * missing/diverging keys into .env. Returns a list of human-readable diffs.
 * Never writes or prints API secrets.
 */
export function backfillEnvFromToml(tomlFacts) {
  const diffs = [];
  const desired = {
    scopes: tomlFacts.scopes.join(","),
    appUrl: tomlFacts.applicationUrl,
    apiKey: tomlFacts.clientId,
  };

  const entries = parseEnvFile() ?? new Map();
  const lines = fs.existsSync(ENV_FILE)
    ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)
    : [];

  const setKey = (key, value) => {
    const existing = entries.get(key);
    if (existing) {
      lines[existing.line - 1] = `${key}=${value}`;
      return `updated ${key} (line ${existing.line})`;
    }
    lines.push(`${key}=${value}`);
    return `added ${key}`;
  };

  for (const [field, value] of Object.entries(desired)) {
    if (!value) continue;
    const keys = FIELD_KEYS[field];
    const current = keys
      .map((key) => entries.get(key))
      .find((entry) => entry && entry.value.trim().length > 0);
    const normalizedCurrent =
      field === "scopes"
        ? current?.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .sort()
            .join(",")
        : current?.value?.trim().replace(/\/+$/, "");
    const normalizedDesired =
      field === "scopes"
        ? value
        : field === "appUrl"
          ? value.replace(/\/+$/, "")
          : value;
    if (current && normalizedCurrent === normalizedDesired) continue;
    const action = setKey(keys[0], value);
    diffs.push(
      `${field}: ${action} -> ${value}${current ? ` (was ${current.value})` : ""}`
    );
  }

  if (diffs.length > 0) {
    fs.writeFileSync(ENV_FILE, lines.join("\n"), "utf8");
  }
  return diffs;
}

export { TOML_TO_FIELD };

import fs from "fs";
import path from "path";
import { maskSecret } from "./mask.js";

export const REQUIRED_ENV_KEYS = [
  "SHOPIFY_API_SCOPES",
  "SHOPIFY_APP_URL",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
];

const unquote = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const parseEnvFile = (root) => {
  const envPath = path.join(root, ".env");
  const result = {
    file: ".env",
    exists: false,
    vars: {},
    missing: [...REQUIRED_ENV_KEYS],
  };

  if (!fs.existsSync(envPath)) {
    return result;
  }

  result.exists = true;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim().startsWith("#")) {
      return;
    }
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      return;
    }
    result.vars[match[1]] = { value: unquote(match[2]), line: index + 1 };
  });

  result.missing = REQUIRED_ENV_KEYS.filter(
    (key) => !result.vars[key] || result.vars[key].value.trim() === ""
  );
  return result;
};

export const extractEnvFacts = (root) => {
  const parsed = parseEnvFile(root);
  const get = (key) => parsed.vars[key] || { value: "", line: null };

  const scopesVar = get("SHOPIFY_API_SCOPES");
  const scopes = scopesVar.value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  let appUrl = get("SHOPIFY_APP_URL").value;
  if (appUrl.endsWith("/")) {
    appUrl = appUrl.slice(0, -1);
  }

  return {
    ...parsed,
    facts: {
      scopes: { list: scopes, line: scopesVar.line },
      appUrl: { value: appUrl, line: get("SHOPIFY_APP_URL").line },
      apiKey: {
        value: get("SHOPIFY_API_KEY").value,
        line: get("SHOPIFY_API_KEY").line,
      },
      apiSecret: {
        masked: maskSecret(get("SHOPIFY_API_SECRET").value),
        line: get("SHOPIFY_API_SECRET").line,
      },
    },
  };
};

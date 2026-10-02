import toml from "@iarna/toml";
import fs from "fs";
import path from "path";

const findLine = (lines, regex, fromIndex = 0) => {
  for (let index = fromIndex; index < lines.length; index++) {
    if (regex.test(lines[index])) {
      return index + 1;
    }
  }
  return null;
};

export const extractTomlFacts = (root) => {
  const tomlPath = path.join(root, "shopify.app.toml");
  const result = {
    file: "shopify.app.toml",
    exists: false,
    scopes: { list: [], line: null },
    applicationUrl: { value: "", line: null },
    clientId: { value: "", line: null },
    subscriptions: [],
    parseError: null,
  };

  if (!fs.existsSync(tomlPath)) {
    return result;
  }

  result.exists = true;
  const raw = fs.readFileSync(tomlPath, "utf8");
  const lines = raw.split(/\r?\n/);

  let parsed;
  try {
    parsed = toml.parse(raw);
  } catch (error) {
    result.parseError = error.message;
    return result;
  }

  result.scopes.line = findLine(lines, /^scopes\s*=/);
  const scopesRaw = parsed.access_scopes?.scopes || "";
  result.scopes.list = String(scopesRaw)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  result.applicationUrl.line = findLine(lines, /^application_url\s*=/);
  result.applicationUrl.value = parsed.application_url || "";

  result.clientId.line = findLine(lines, /^client_id\s*=/);
  result.clientId.value = parsed.client_id || "";

  const subscriptions = parsed.webhooks?.subscriptions || [];
  let searchFrom = 0;
  for (const subscription of subscriptions) {
    const topicsLine = findLine(lines, /^\s*topics\s*=\s*\[/, searchFrom);
    const uriLine = findLine(lines, /^\s*uri\s*=/, searchFrom);
    searchFrom = Math.max(topicsLine || 0, uriLine || 0);
    result.subscriptions.push({
      topics: subscription.topics || [],
      uri: subscription.uri || "",
      line: topicsLine,
      uriLine,
    });
  }

  return result;
};

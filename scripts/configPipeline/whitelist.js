import fs from "fs";
import path from "path";

export const loadWebhookTopicWhitelist = (root) => {
  const whitelistPath = path.join(
    root,
    "_developer",
    "types",
    "webhookTopics.js"
  );
  const topics = new Set();

  if (!fs.existsSync(whitelistPath)) {
    return { file: "_developer/types/webhookTopics.js", exists: false, topics };
  }

  const content = fs.readFileSync(whitelistPath, "utf8");
  const matches = content.matchAll(/'([^']+)'/g);
  for (const match of matches) {
    const candidate = match[1];
    if (candidate.includes("/") || candidate.includes(".")) {
      topics.add(candidate);
    }
  }

  return { file: "_developer/types/webhookTopics.js", exists: true, topics };
};

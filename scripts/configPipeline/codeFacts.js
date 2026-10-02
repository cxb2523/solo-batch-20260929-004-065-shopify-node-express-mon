import fs from "fs";
import path from "path";

const ROUTE_REGEX =
  /\b(?:app|router)\.(get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/g;

const walkJsFiles = (dir, collected = []) => {
  if (!fs.existsSync(dir)) {
    return collected;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(fullPath, collected);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      collected.push(fullPath);
    }
  }
  return collected;
};

const lineOf = (content, index) => content.slice(0, index).split("\n").length;

export const extractRouteFacts = (root) => {
  const serverDir = path.join(root, "server");
  const routes = [];

  for (const filePath of walkJsFiles(serverDir)) {
    const relative = path.relative(root, filePath).split(path.sep).join("/");
    const content = fs.readFileSync(filePath, "utf8");
    let match;
    while ((match = ROUTE_REGEX.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: relative,
        line: lineOf(content, match.index),
      });
    }
  }

  return routes;
};

export const extractWebhookFacts = (root) => {
  const shopifyUtilPath = path.join(root, "utils", "shopify.js");
  const registered = [];

  if (fs.existsSync(shopifyUtilPath)) {
    const content = fs.readFileSync(shopifyUtilPath, "utf8");
    const entryRegex =
      /topics\s*:\s*\[([\s\S]*?)\][\s\S]{0,300}?url\s*:\s*["'`]([^"'`]+)["'`]/g;
    let match;
    while ((match = entryRegex.exec(content)) !== null) {
      const topics = [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map(
        (topicMatch) => topicMatch[1]
      );
      registered.push({
        topics,
        url: match[2],
        file: "utils/shopify.js",
        line: lineOf(content, match.index),
      });
    }
  }

  const handlerPath = path.join(root, "server", "webhooks", "_index.js");
  const handlers = [];
  if (fs.existsSync(handlerPath)) {
    const lines = fs.readFileSync(handlerPath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/case\s+"([A-Z_]+)"/);
      if (match) {
        handlers.push({
          topic: match[1],
          file: "server/webhooks/_index.js",
          line: index + 1,
        });
      }
    });
  }

  const ingress = extractRouteFacts(root).filter((route) =>
    route.path.startsWith("/api/webhooks")
  );

  return { registered, handlers, ingress };
};

import fs from "fs";
import path from "path";
import { SERVER_DIR, SHOPIFY_UTIL, WEBHOOK_TOPICS_TYPES } from "./paths.js";

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** Load the webhook topic whitelist from _developer/types/webhookTopics.js. */
export function loadTopicWhitelist() {
  const content = fs.readFileSync(WEBHOOK_TOPICS_TYPES, "utf8");
  const topics = new Set();
  for (const match of content.matchAll(/'([^']+)'/g)) {
    topics.add(match[1]);
  }
  return topics;
}

/**
 * Extract registered Express routes from all server JS files.
 * Heuristic: `.get("/path"`, `.post(`, `.use(` etc. with string literals.
 */
export function collectRouteFacts() {
  const routes = [];
  const methodRe =
    /\.(get|post|put|patch|delete|all|use)\(\s*["'`]([^"'`]+)["'`]/g;
  for (const file of walk(SERVER_DIR)) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(methodRe)) {
      const line = content.slice(0, match.index).split("\n").length;
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file,
        line,
      });
    }
  }
  return routes;
}

/**
 * Extract webhook subscriptions declared in utils/shopify.js
 * (topics + url per entry, with line numbers).
 */
export function collectWebhookFacts() {
  const webhooks = [];
  if (!fs.existsSync(SHOPIFY_UTIL)) return webhooks;
  const lines = fs.readFileSync(SHOPIFY_UTIL, "utf8").split(/\r?\n/);
  let currentTopics = null;
  lines.forEach((line, index) => {
    const topicsMatch = line.match(/topics:\s*\[([^\]]*)\]/);
    if (topicsMatch) {
      currentTopics = {
        topics: [...topicsMatch[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map(
          (m) => m[1]
        ),
        line: index + 1,
      };
      return;
    }
    const urlMatch = line.match(/url:\s*["'`]([^"'`]+)["'`]/);
    if (urlMatch && currentTopics) {
      webhooks.push({
        topics: currentTopics.topics,
        topicsLine: currentTopics.line,
        url: urlMatch[1],
        urlLine: index + 1,
        file: SHOPIFY_UTIL,
      });
      currentTopics = null;
    }
  });
  return webhooks;
}

/** Webhook entry points registered on the Express app (server/index.js). */
export function collectWebhookEntryRoutes() {
  return collectRouteFacts().filter((route) =>
    route.path.startsWith("/api/webhooks")
  );
}

export function collectCodeFacts() {
  const whitelist = loadTopicWhitelist();
  const routes = collectRouteFacts();
  const webhooks = collectWebhookFacts();
  const webhookTopics = [
    ...new Set(webhooks.flatMap((webhook) => webhook.topics)),
  ].sort();
  const unknownTopics = [];
  for (const webhook of webhooks) {
    for (const topic of webhook.topics) {
      if (!whitelist.has(topic)) {
        unknownTopics.push({
          topic,
          file: webhook.file,
          line: webhook.topicsLine,
        });
      }
    }
  }
  return {
    routes,
    webhooks,
    webhookTopics,
    webhookEntryRoutes: collectWebhookEntryRoutes(),
    unknownTopics,
    whitelistSize: whitelist.size,
  };
}

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..", "..");
export const ENV_FILE = path.join(ROOT, ".env");
export const TOML_FILE = path.join(ROOT, "shopify.app.toml");
export const SERVER_DIR = path.join(ROOT, "server");
export const SHOPIFY_UTIL = path.join(ROOT, "utils", "shopify.js");
export const WEBHOOK_TOPICS_TYPES = path.join(
  ROOT,
  "_developer",
  "types",
  "webhookTopics.js"
);
export const TOML_WRITER = path.join(ROOT, "_developer", "tomlWriter.js");
export const REPORT_JSON = path.join(
  ROOT,
  "client",
  "public",
  "config-report.json"
);

# Config Pipeline

`scripts/configPipeline/` keeps `.env`, the Express/webhook code in `server/`
and `shopify.app.toml` in sync, and proves it with a sanitized report.

## Commands

- `npm run config:sync` — default direction: `.env` + code routes are the
  single source of truth. Regenerates `shopify.app.toml` by driving
  `_developer/tomlWriter.js` / `webhookWriter.js`, then verifies both ways.
  Runs automatically as `predev` / `prebuild`.
- `npm run config:verify` — read-only check. Exits non-zero on any drift and
  prints the expected value plus source file and line for each finding.
- `npm run config:from-toml` — reverse direction: backfills missing/diverging
  keys into `.env` from `shopify.app.toml` and lists the diffs.
- `--strict` (or `CI` env var) — missing env fields and any extras hard-fail,
  which interrupts `prebuild`. Locally, a missing `.env` or missing fields
  only degrade to warnings and exit 0.

## Facts checked

- `.env`: `SHOPIFY_API_SCOPES` / `SHOPIFY_APP_URL` / `SHOPIFY_API_KEY` /
  `SHOPIFY_API_SECRET` (short aliases `SCOPES` / `APP_URL` / `API_KEY` /
  `API_SECRET` also accepted). Secrets are only ever printed as
  `sha256:<first 8 hex chars>`.
- `server/`: registered Express routes and webhook entries
  (`utils/shopify.js` `webhooks` array, `server/webhooks/_index.js`).
- `shopify.app.toml`: `access_scopes.scopes`, `application_url`, `client_id`,
  `webhooks.subscriptions[].topics`.
- Webhook topics must appear in the `_developer/types/webhookTopics.js`
  whitelist; unknown topics are reported as drift.

## Report

Every run writes `client/public/config-report.json` containing both the
structured data and a human-readable rendering (`human` lines). The CLI
prints the human section; the `/debug/config` page
(`client/pages/debug/Config.jsx`) fetches the same JSON, so both surfaces
are always in sync.

Evidence captures live in `docs/config-pipeline/cli-evidence.txt` and
`docs/config-pipeline/page-evidence.txt`.

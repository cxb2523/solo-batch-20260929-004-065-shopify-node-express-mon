# Config Pipeline Evidence

Artifacts produced by `scripts/configPipeline/` (wired into `predev` /
`prebuild`, see `package.json`).

## Files

- `config-report.json` / `config-report.txt` — latest report (JSON + human
  readable sections, same run). The JSON is byte-identical to
  `client/public/debug/config-report.json`, which the `/debug/config` page
  fetches, so CLI and page share one source.
- `config-verify-clean.txt` — `npm run config:verify` on a clean checkout
  (no `.env`): degrades to warnings, exit 0.
- `config-verify-ok.txt` — `npm run config:verify` with `.env` +
  `shopify.app.toml` in sync: exit 0.
- `config-verify-drift.txt` — `npm run config:verify` after manually changing
  one scope in `shopify.app.toml` (`write_products` -> `write_orders`):
  exit 1, lists expected value plus source files and line numbers
  (`.env:3`, `shopify.app.toml:14`).

## Page evidence

- Route: `/debug/config` (`client/pages/debug/Config.jsx`, registered in
  `client/Routes.jsx`).
- Data source: `/debug/config-report.json`, served from
  `client/public/debug/config-report.json` (dev) and copied to
  `dist/client/debug/config-report.json` on `vite build`.
- `npm run build` passes with the page included (prebuild runs the pipeline
  first and regenerates the report).

## Notes

- Secrets are never printed: `SHOPIFY_API_SECRET` (and any
  `SECRET|TOKEN|PASSWORD|ENCRYPTION` key) appears only as `sha256:<8 hex>`.
- `.env` and `shopify.app.toml` in this workspace contain demo values only;
  both are gitignored.

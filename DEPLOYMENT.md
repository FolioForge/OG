# Deployment Runbook

## Local Development
1. Install deps: `npm install`
2. Start API/UI: `npm run dev`
3. Start MCP (separate terminal): `npm run mcp`
4. Open job library: `http://localhost:4010/jobs`
5. API health: `http://localhost:4010/healthz`

## Required Environment Variables
- `PORT` default: `4010`
- `HOST` default: `0.0.0.0`
- `PUBLIC_BASE_URL` default: `http://localhost:<PORT>`
- `DATA_DIR` default: `./data`
- `DB_PATH` default: `<DATA_DIR>/og.db`
- `IMAGE_DIR` default: `<DATA_DIR>/og-images`
- `MAX_REMOTE_IMAGE_BYTES` default: `10485760`
- `REMOTE_FETCH_TIMEOUT_MS` default: `8000`
- `ALLOW_PRIVATE_SOURCE_IMAGES` default: `false`
- `API_KEYS` format: `name:key:tier,name2:key2:tier2`
- `REQUIRE_API_KEY` default: `true` when `API_KEYS` is set
- `OUTSIDER_RATE_LIMIT_PER_MINUTE` default: `60`
- `ANONYMOUS_RATE_LIMIT_PER_MINUTE` default: `20`
- `INTERNAL_RATE_LIMIT_PER_MINUTE` default: `0` (unlimited)
- `ENABLE_CORS` default: `true`
- `CORS_ORIGIN` default: `*`

## GitHub Prep (Repository)
1. Initialize git if needed: `git init`
2. Ensure `.gitignore` excludes `node_modules`, `data`, `.env`, and `dist`.
3. Copy `.env.example` to `.env` and set secrets.
4. Validate locally:
   - `npm run check`
   - `npm run build`
   - `npm run test:e2e`
5. Push to GitHub.

## API Key Setup
1. Generate internal key: `npm run gen:api-key -- personal internal`
2. Generate outsider key: `npm run gen:api-key -- public outsider`
3. Set `API_KEYS` using generated values.
4. Set `REQUIRE_API_KEY=true` in hosted environments.

## Production Hosting (Recommended)
1. Host API/UI on Render or Railway as one web service.
2. Run MCP stdio as a separate process for local agents.
3. Use persistent disk for `DATA_DIR` in beta.
4. Move image storage to R2/S3 in next phase.

## Suggested Production Topology
1. `api.myogdomain.com` -> Fastify API and `/jobs` UI
2. `mcp.myogdomain.com` -> HTTP MCP transport (phase 2)
3. CDN-backed object storage for generated images

## Build and Start Commands
- Build: `npm run build`
- Start API: `npm run start`
- Start MCP: `npm run mcp`
- E2E: `npm run test:e2e`

## Managed Enterprise Pattern
1. Use one internal API key per owned product (FolioForge, etc.).
2. Issue outsider keys for external users and keep lower limits.
3. Log request metadata (tenant/user headers) at your reverse proxy.
4. Rotate keys by replacing `API_KEYS` and restarting service.

## Launch Checklist
1. Set `PUBLIC_BASE_URL` to public HTTPS origin.
2. Keep `ALLOW_PRIVATE_SOURCE_IMAGES=false`.
3. Set `REQUIRE_API_KEY=true` and configure `API_KEYS`.
4. Keep outsider limits enabled (`OUTSIDER_RATE_LIMIT_PER_MINUTE`).
5. Keep anonymous limits low or set `REQUIRE_API_KEY=true`.
6. Configure monitoring and uptime checks.

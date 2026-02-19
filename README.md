# OG Image Generator (MCP-First)

MCP-first OG image service with:
- HTTP API (`/v1/og/*`)
- MCP stdio tools
- SQLite job/mapping persistence
- Human job library UI (`/jobs`)
- API key auth + tiered rate limiting for hosted mode

## Quick Start
1. `npm install`
2. `npm run dev` (API + UI)
3. `npm run mcp` (MCP stdio server)
4. `npm run test:e2e`

Default API URL: `http://localhost:4010`
Default health URL: `http://localhost:4010/healthz`

## Managed Hosting Mode (Enterprise-Friendly)
1. Generate keys:
   - `npm run gen:api-key -- personal internal`
   - `npm run gen:api-key -- public outsider`
2. Set env:
   - `API_KEYS=personal:<key1>:internal,public:<key2>:outsider`
   - `REQUIRE_API_KEY=true`
   - `OUTSIDER_RATE_LIMIT_PER_MINUTE=60`
   - `INTERNAL_RATE_LIMIT_PER_MINUTE=0`
3. Call API with `x-api-key: <key>` or `Authorization: Bearer <key>`.
4. Outsider keys are rate-limited; internal keys can be unlimited (`0`).
5. Browser clients can be enabled via `ENABLE_CORS=true` and `CORS_ORIGIN=<origin or *>`.

## Rendering Notes
- Timestamps now include ISO fields (`createdAtIso`, `updatedAtIso`) in API responses and `created_at_iso`, `updated_at_iso` in MCP responses.
- Default font stack is `Inter, Arial, sans-serif`. If Inter is not installed on host infrastructure, rendering falls back to Arial/sans-serif.
- Optional Inter asset guidance is in `fonts/README.md`.

## HTTP Endpoints
- `POST /v1/og/jobs`
- `GET /v1/og/jobs`
- `GET /v1/og/jobs/:jobId`
- `POST /v1/og/mappings`
- `GET /v1/og/mappings/by-url`
- `GET /v1/og/templates`
- `GET /v1/og/presets`
- `GET /jobs`

## MCP Tools
- `create_og_image`
- `list_og_jobs`
- `get_og_job`
- `attach_og_to_url`

## Docs
- `DEPLOYMENT.md`
- `ENTERPRISE_SETUP.md`
- `HUMAN_OWNER_CHECKLIST.md`
- `FOLIOFORGE_PILOT_RUNBOOK.md`

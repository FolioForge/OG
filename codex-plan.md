# MCP-First OG Creator: Incremental, E2E-Testable Build Plan

## Summary
Build a Node.js + TypeScript service that is agent-first (MCP stdio tools), exposes versioned HTTP APIs, and includes a human-facing read-only job library UI. Milestone 1 delivers complete usable value end-to-end: create OG image from URL/upload, overlay text, persist job history + URL mapping, call via MCP, view results in UI, and verify with automated E2E tests.

## Chosen Decisions (Locked)
- Stack: Node.js + TypeScript with npm
- Renderer: sharp + SVG text overlay
- Execution model: synchronous generation for v1
- Persistence: local SQLite file
- MCP transport v1: stdio
- Auth v1: dev-open by default with optional API-key hook
- Inputs v1: remote URL and file upload
- Template scope v1: one canonical template
- UI v1: read-only job library
- Output v1: PNG only
- URL mapping: one active OG image per page URL (latest wins)
- MCP tools v1: create, list, get, attach
- Route versioning: /v1/*
- E2E gate: API + MCP + UI smoke

## Architecture
1. Single service codebase with shared core modules used by both API and MCP.
2. Local filesystem for binary images, SQLite for metadata.
3. API server serves JSON endpoints (/v1/...), static generated images (/assets/og/), and human UI (/jobs).
4. MCP server process (stdio) imports same core service and exposes tools.

## Project Structure
- package.json
- tsconfig.json
- src/config.ts
- src/core/types.ts
- src/core/renderer.ts
- src/core/image-source.ts
- src/core/repository.ts
- src/core/service.ts
- src/db/migrations/001_init.sql
- src/db/init.ts
- src/api/server.ts
- src/api/routes/jobs.ts
- src/api/routes/mappings.ts
- src/api/routes/templates.ts
- src/ui/jobs-page.ts
- src/mcp/server.ts
- tests/e2e/api.e2e.test.ts
- tests/e2e/mcp.e2e.test.ts
- tests/e2e/ui.e2e.test.ts
- data/og-images/ (runtime)
- data/og.db (runtime)

## Public Interfaces
### HTTP API (/v1)
1. POST /v1/og/jobs
- Content types: application/json, multipart/form-data
- Request: sourceImageUrl? | sourceImageFile?, title, subtitle?, pageUrl?, templateId?
- Rule: exactly one of sourceImageUrl or sourceImageFile
- Response 201: jobId, status=completed, imageUrl, width=1200, height=630, createdAt, pageUrl?

2. GET /v1/og/jobs
- Query: limit? (default 20, max 100), cursor?
- Response: items, nextCursor?

3. GET /v1/og/jobs/:jobId
- Response: OgJob

4. POST /v1/og/mappings
- Request: pageUrl, jobId
- Behavior: upsert single active mapping per URL
- Response: pageUrl, jobId, imageUrl, updatedAt

5. GET /v1/og/mappings/by-url
- Query: url
- Response: pageUrl, jobId, imageUrl, updatedAt

6. GET /v1/og/templates
- Response: [{ id: canonical, name: Canonical OG, size: { width: 1200, height: 630 } }]

### MCP Tools (stdio)
1. create_og_image
- Input: title, subtitle?, page_url?, template_id?, source_image_url | source_image_base64
- Output: job_id, image_url, status, created_at

2. list_og_jobs
- Input: limit?, cursor?
- Output: items, next_cursor?

3. get_og_job
- Input: job_id
- Output: full job record

4. attach_og_to_url
- Input: page_url, job_id
- Output: mapping record

### UI
1. GET /jobs
- Server-rendered page with latest jobs, thumbnail, title/subtitle/page URL, created timestamp, status badge
2. GET /jobs/:jobId (optional in M1 if time allows)
- Detail page for one job

## Data Model
1. og_jobs
- id TEXT PK
- source_type TEXT (url|upload)
- source_ref TEXT
- title TEXT
- subtitle TEXT NULL
- template_id TEXT
- output_path TEXT
- output_url TEXT
- width INTEGER
- height INTEGER
- status TEXT (completed|failed)
- error_message TEXT NULL
- created_at TEXT

2. url_mappings
- page_url TEXT PK
- job_id TEXT
- image_url TEXT
- updated_at TEXT
- FK job_id -> og_jobs.id

## Rendering and Validation Rules
1. Target size fixed at 1200x630.
2. Source normalization uses cover fit with center crop.
3. Text overlay uses canonical bottom gradient panel, title max 2 lines, subtitle max 1 line, auto-wrap/auto-shrink/ellipsis fallback.
4. Input limits: fetch timeout 8s, max source size 10MB, mime png/jpeg/webp.
5. Text limits: title max 140 chars, subtitle max 120 chars.
6. Errors: validation 400 with machine-readable code; fetch/processing 422 or 500.

## Milestone 1: End-to-End MVP
1. Scaffold TypeScript service and runtime config.
2. Implement SQLite init + migrations.
3. Implement POST /v1/og/jobs with URL/upload ingestion.
4. Implement OG render pipeline and file output.
5. Implement jobs list/get endpoints.
6. Implement URL mapping endpoints.
7. Implement MCP stdio server with 4 tools.
8. Implement /jobs read-only UI.
9. Add E2E tests and CI command npm run test:e2e.

Acceptance:
- Agent can create image via MCP and receive stable URL.
- Human can see created job in /jobs.
- URL mapping is stored and retrievable.
- E2E tests pass on clean setup.

## Milestone 2: Template and Brand Value
1. Add template registry abstraction.
2. Add clean and bold templates.
3. Add brand profile config (font/color/logo constraints).
4. Add deterministic template preview endpoint.
5. Expand UI filters by template/status/date.

Acceptance:
- Template choice changes output deterministically.
- Brand constraints prevent invalid color/font inputs.
- E2E tests cover multi-template generation.

## Milestone 3: Agent Distribution and Production Hardening
1. Optional API key enforcement toggle.
2. Add remote storage adapter interface and R2/S3 implementation.
3. Add MCP packaging metadata and registry-ready docs.
4. Add health endpoint and structured logs.
5. Add rate-limit middleware and request-id tracing.

Acceptance:
- Service runs with local storage or R2/S3 via config only.
- MCP server is installable and documented for agent clients.
- Production mode passes smoke tests with auth on.

## Test Cases and Scenarios
### API E2E
1. Create from remote URL returns 201 + PNG URL and file exists.
2. Create from multipart upload returns 201 + persisted job.
3. Both URL and file returns 400.
4. Invalid URL returns 400.
5. Unsupported mime returns 422.
6. List endpoint supports pagination.
7. Get endpoint returns exact job.
8. Mapping upsert works.
9. Mapping by URL returns latest job.
10. /jobs includes created job metadata and preview URL.

### MCP E2E
1. create_og_image succeeds.
2. list_og_jobs includes created job.
3. get_og_job returns full record.
4. attach_og_to_url persists mapping.
5. Validation errors are structured.

### Non-Functional Smoke
1. Generate 20 jobs sequentially with stable memory.
2. Restart service and verify jobs remain in SQLite.

## Assumptions and Defaults
1. Runtime Node 20+.
2. Paths: ./data/og.db and ./data/og-images.
3. Base URL default http://localhost:3000.
4. Auth off by default; API_KEY enables key checks.
5. MCP v1 is stdio only; HTTP transport deferred.
6. No delete endpoint in v1.
7. Repo is currently empty, so bootstrap from scratch.

## Delivery Sequence
1. Implement Milestone 1 completely.
2. Run E2E and fix until green.
3. Tag v0.1.0.
4. Proceed to Milestones 2 and 3.

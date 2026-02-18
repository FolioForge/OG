# OG Image Generator -- MCP-First Build Plan (Revised)

## Context
A solopreneur tool that eliminates the multi-step workflow of AI image generation, resize, text overlay, and URL association. Built MCP-first so AI agents can discover and use it via the MCP Registry. Also exposes a versioned REST API and a read-only web UI for humans to browse generated work.

**Primary customer:** AI agents acting on behalf of content creators.
**Secondary customer:** The solopreneur directly, via API/UI.

### Revision Notes
This plan merges learnings from Codex's plan and both cross-reviews:
- Full E2E vertical in M1 (not thin horizontal layers)
- Job abstraction with durable IDs across all interfaces
- SVG text overlay via Sharp (no @napi-rs/canvas dependency)
- Versioned API routes (/v1/)
- Separate entrypoints for API and MCP (no stdout contamination)
- SSRF protection and input validation from day 1
- Query-based URL lookup (not base64 path encoding)
- Local test fixtures (not remote URLs for core tests)
- Multi-platform presets in M1 (core to the problem)
- 2 templates in M1 (not 1 or 4)
- No auth in M1 (YAGNI)
- UI in M1 (user requirement)
- All decisions locked (no TBDs)

---

## Tech Stack (Locked)
- **Runtime:** Node.js 20+, TypeScript, ESM
- **Image processing:** Sharp (Apache-2.0) -- resize, crop, composite, SVG text overlay
- **Text rendering:** SVG composited via Sharp (no canvas dependency)
- **MCP:** @modelcontextprotocol/sdk, stdio transport in v1
- **API:** Fastify with CORS, multipart, static serving
- **Database:** better-sqlite3 (job metadata, URL mappings)
- **Fonts:** Inter .ttf bundled in fonts/ (referenced by SVG for consistent rendering)
- **IDs:** nanoid for job IDs
- **UI:** Server-rendered HTML (no framework, no TBD)

---

## Project Structure
```
OG/
  package.json
  tsconfig.json
  .gitignore
  CLAUDE.md
  fonts/
    Inter-Regular.ttf
    Inter-Bold.ttf
  fixtures/
    test-image.jpg              # Local test fixture (1920x1080 JPEG)
  src/
    core/
      types.ts                  # Shared types (OgJob, Platform, Template, etc.)
      presets.ts                # Platform size definitions
      templates.ts              # Template rendering configs (2 in M1)
      renderer.ts               # Sharp resize + SVG text overlay
      image-source.ts           # Fetch remote URL or read local file (with SSRF protection)
      service.ts                # Orchestrator: ingest, render, persist, return job
    storage/
      database.ts               # SQLite init, migrations, queries
      filesystem.ts             # Save/load images from data/og-images/
    mcp/
      server.ts                 # MCP stdio server (separate entrypoint)
    api/
      server.ts                 # Fastify HTTP server (separate entrypoint)
      routes/
        jobs.ts                 # POST/GET /v1/og/jobs
        mappings.ts             # POST/GET /v1/og/mappings
        templates.ts            # GET /v1/og/templates
        presets.ts              # GET /v1/og/presets
    ui/
      jobs-page.ts              # Server-rendered HTML for /jobs
  tests/
    e2e/
      api.e2e.test.ts           # 10 API test scenarios
      mcp.e2e.test.ts           # 5 MCP test scenarios
      ui.e2e.test.ts            # UI smoke test
  data/                         # Runtime (gitignored)
    og.db
    og-images/
```

### Key Architecture Decisions
1. **Two entrypoints:** `src/api/server.ts` (HTTP) and `src/mcp/server.ts` (stdio). Never run both in one process -- MCP stdio requires exclusive stdout.
2. **Shared core:** Both entrypoints import `src/core/service.ts` which orchestrates all logic.
3. **Job model:** Every generation is an `OgJob` with a durable `id` used consistently across MCP tools, API responses, URL mappings, and UI.

---

## Data Model

### og_jobs
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | nanoid |
| source_type | TEXT | "url" or "upload" |
| source_ref | TEXT | Original URL or upload filename |
| title | TEXT | Max 140 chars |
| subtitle | TEXT NULL | Max 120 chars |
| platform | TEXT | "og", "twitter", or "linkedin" |
| template_id | TEXT | "gradient-bottom" or "center-dark" |
| output_path | TEXT | Relative path in data/og-images/ |
| output_url | TEXT | Servable URL path (/assets/og/...) |
| width | INTEGER | |
| height | INTEGER | |
| status | TEXT | "completed" or "failed" |
| error_message | TEXT NULL | Populated on failure |
| created_at | TEXT | ISO 8601 |

### url_mappings
| Column | Type | Notes |
|--------|------|-------|
| page_url | TEXT PK | The blog/page URL |
| job_id | TEXT FK | References og_jobs.id |
| image_url | TEXT | Servable URL for the OG image |
| updated_at | TEXT | ISO 8601 |

One active mapping per page URL. Latest wins on upsert.

---

## Platform Presets (in M1)
| Platform | Width | Height |
|----------|-------|--------|
| og | 1200 | 630 |
| twitter | 1200 | 675 |
| linkedin | 1200 | 627 |

Default: `og` if not specified.

## Templates (in M1)
| ID | Name | Style |
|----|------|-------|
| gradient-bottom | Gradient Bottom | Bottom gradient overlay, white title bottom-left, light subtitle below |
| center-dark | Center Dark | Full semi-transparent dark tint, centered white title and subtitle |

Default: `gradient-bottom` if not specified.

---

## Input Validation and Security (from day 1)

### Remote Image Fetch
- **SSRF protection:** Block private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fc00::/7)
- **Redirect limit:** Max 3 redirects, re-validate each target
- **Timeout:** 8 seconds
- **Max size:** 10MB
- **Allowed MIME:** image/png, image/jpeg, image/webp
- **Protocol:** HTTPS and HTTP only (no file://, ftp://, etc.)

### Text Input
- Title: required, max 140 characters
- Subtitle: optional, max 120 characters

### Validation Errors
Return structured errors for agents to self-correct:
```json
{ "error": { "code": "TITLE_TOO_LONG", "message": "Title exceeds 140 characters", "max": 140 } }
```

---

## MCP Tools (stdio)

Tool descriptions are critical -- they are "SEO for agents." Each description must clearly state what the tool does, what inputs it accepts, and what it returns.

### 1. create_og_image
- **Description:** "Generate a social media OG image from an existing image. Resizes to the target platform dimensions, overlays title text using the selected template, and returns the job record with a servable image URL."
- **Inputs:** source_image_url (string, required) OR source_image_base64 (string), title (string, required, max 140), subtitle (string, optional, max 120), platform (enum: og|twitter|linkedin, default: og), template_id (enum: gradient-bottom|center-dark, default: gradient-bottom), page_url (string, optional -- auto-maps if provided)
- **Returns:** job_id, status, image_url, width, height, created_at, page_url

### 2. list_og_jobs
- **Description:** "List previously generated OG image jobs with pagination. Returns job metadata including image URLs, titles, and creation timestamps."
- **Inputs:** limit (number, default 20, max 100), cursor (string, optional)
- **Returns:** items[], next_cursor

### 3. get_og_job
- **Description:** "Get full details of a specific OG image generation job by its ID."
- **Inputs:** job_id (string, required)
- **Returns:** Full OgJob record

### 4. attach_og_to_url
- **Description:** "Map a generated OG image to a page URL. When someone shares this URL, this OG image will be associated with it. Overwrites any previous mapping for the same URL."
- **Inputs:** page_url (string, required), job_id (string, required)
- **Returns:** page_url, job_id, image_url, updated_at

---

## HTTP API (/v1)

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/og/jobs | Create OG image (JSON with URL or multipart with file upload) |
| GET | /v1/og/jobs | List jobs (query: limit, cursor) |
| GET | /v1/og/jobs/:jobId | Get single job |
| POST | /v1/og/mappings | Map a page URL to a job (body: page_url, job_id) |
| GET | /v1/og/mappings/by-url | Lookup mapping (query: url=https://...) |
| GET | /v1/og/templates | List available templates |
| GET | /v1/og/presets | List platform presets with dimensions |
| GET | /assets/og/* | Serve generated images (static) |
| GET | /jobs | Human-readable job library UI |

### POST /v1/og/jobs
- Content types: application/json, multipart/form-data
- JSON body: `{ source_image_url, title, subtitle?, platform?, template_id?, page_url? }`
- Multipart: source_image_file + title + subtitle? + platform? + template_id? + page_url?
- Rule: exactly one of source_image_url or source_image_file
- Response 201: full OgJob record

---

## UI: Job Library

**Technology:** Server-rendered HTML from `src/ui/jobs-page.ts`. No framework.

### GET /jobs
- Grid of generated OG images, newest first
- Each card shows: thumbnail, title, subtitle, platform badge, template, creation time
- If mapped to a URL, show the URL below the card
- Pagination via query param

### GET /jobs/:jobId (stretch goal)
- Full-size image preview
- All metadata
- Mapped URL if any
- Download button

---

## Milestone 1: End-to-End MVP

Everything above ships as a single milestone. This is the minimum viable vertical slice.

### Build Order (within M1)
1. Project scaffold: package.json, tsconfig.json, .gitignore, CLAUDE.md
2. `src/core/types.ts` -- all shared types
3. `src/core/presets.ts` -- platform dimensions
4. `src/core/templates.ts` -- 2 template configs
5. `src/core/image-source.ts` -- fetch/read with SSRF protection
6. `src/core/renderer.ts` -- Sharp resize + SVG text composite
7. `src/storage/database.ts` -- SQLite init + migrations + queries
8. `src/storage/filesystem.ts` -- save/load from data/og-images/
9. `src/core/service.ts` -- orchestrator tying it all together
10. `src/mcp/server.ts` -- MCP stdio with 4 tools
11. `src/api/server.ts` + routes -- Fastify with all endpoints
12. `src/ui/jobs-page.ts` -- server-rendered job library
13. `tests/e2e/` -- all test suites
14. Install dependencies, bundle fonts, run tests

### Dependencies (all for M1)
```
sharp
typescript
tsx
@types/node
@modelcontextprotocol/sdk
better-sqlite3
@types/better-sqlite3
nanoid
fastify
@fastify/cors
@fastify/static
@fastify/multipart
```

---

## Test Plan (Specified Upfront)

### API E2E (tests/e2e/api.e2e.test.ts)
1. POST /v1/og/jobs with source URL returns 201 + PNG exists at output_url
2. POST /v1/og/jobs with multipart file upload returns 201
3. POST /v1/og/jobs with both URL and file returns 400
4. POST /v1/og/jobs with invalid URL returns 400
5. POST /v1/og/jobs with title > 140 chars returns 400 with structured error
6. GET /v1/og/jobs returns list with pagination
7. GET /v1/og/jobs/:id returns exact job
8. POST /v1/og/mappings upserts correctly
9. GET /v1/og/mappings/by-url returns mapped job
10. GET /jobs returns HTML with job thumbnails

### MCP E2E (tests/e2e/mcp.e2e.test.ts)
1. create_og_image with local fixture succeeds, returns job_id + image_url
2. list_og_jobs includes the created job
3. get_og_job returns full record matching job_id
4. attach_og_to_url creates mapping, retrievable via API
5. create_og_image with invalid input returns structured error

### Non-Functional Smoke (tests/e2e/smoke.test.ts)
1. Generate 20 jobs sequentially -- no memory leak
2. Restart service -- all jobs persist in SQLite

### Test Fixtures
- `fixtures/test-image.jpg` -- bundled 1920x1080 JPEG for offline core tests
- Remote URL tests use picsum.photos but are tagged as integration tests (skippable)

---

## Milestone 2: Templates and Brand Value

1. Add template registry abstraction (pluggable templates)
2. Add 2 more templates: `minimal` (small text, bottom-right) and `announcement` (bold center band)
3. Brand profile config (constrained fonts/colors/logo)
4. Template preview endpoint (deterministic, cacheable)
5. UI filters by template, platform, date range

Acceptance: Template choice changes output deterministically. E2E covers multi-template.

---

## Milestone 3: Agent Distribution and Production Hardening

1. Optional API key enforcement (toggle via env var)
2. Remote storage adapter (R2/S3) swappable via config
3. MCP Registry packaging and listing (registry.modelcontextprotocol.io)
4. Smithery + OpenTools + PulseMCP directory listings
5. Health endpoint (GET /healthz)
6. Structured JSON logs
7. Rate limiting middleware
8. Request-id tracing
9. WebP output format option

Acceptance: Runs with local or cloud storage via config only. MCP server listed in registry. Auth mode passes smoke tests.

---

## Build Order Summary

| Milestone | Delivers | Testable By |
|-----------|----------|-------------|
| M1: E2E MVP | Create OG image via MCP or API, persist job, map URL, view in UI | npm run test:e2e (API + MCP + UI smoke) |
| M2: Templates | More templates, brand config, UI filters | Template E2E, visual diff |
| M3: Production | Auth, cloud storage, registry listing, observability | Smoke tests with auth, deploy to Cloudflare |

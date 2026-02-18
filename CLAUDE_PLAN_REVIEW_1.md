# Review 1: CLAUDE_PLAN.md

Date: 2026-02-17
Reviewer: Codex

## Key Learnings

### 1) MCP contract must include durable IDs
- Current tool contract for `generate_og_image` returns file path/thumbnail/metadata, but later flow requires mapping by ID.
- Learning: return `job_id` (or `image_id`) at generation time and use it consistently across `map_url`, lookup, and listing.

### 2) Keep MCP stdio process isolated from API server output
- The plan suggests one entrypoint starting both MCP and API.
- Learning: run MCP stdio as a separate process to avoid stdout/stderr contamination and protocol instability.

### 3) Remote image ingestion needs security controls in v1
- URL-driven generation appears without explicit guardrails.
- Learning: add SSRF protections (block private/link-local ranges), strict size caps, timeout, MIME validation, and redirect limits from day one.

### 4) URL lookup route should avoid fragile base64 path encoding
- `GET /api/og/:url` with base64 path can break on slash-containing payloads.
- Learning: use query parameter lookup (`/api/og/by-url?url=...`) or URL-safe base64 variant with explicit decode rules.

### 5) Eliminate TBD decisions to make plan implementation-ready
- UI stack left as “TBD”.
- Learning: lock choices in-plan (even minimal defaults) so implementers do not make product decisions during execution.

### 6) E2E tests should be deterministic and offline-capable
- External sample image URLs increase flakiness.
- Learning: include local fixtures for core tests; keep remote-fetch scenarios as optional integration tests.

### 7) “MCP-first” value should appear in first deliverable
- Increment 1 currently delivers only local script output.
- Learning: include at least one usable MCP tool in the first increment to align with stated strategy.

### 8) Normalize document encoding
- The plan contains mojibake artifacts (e.g., `â€”`, `â†’`).
- Learning: enforce UTF-8 (without corruption) to keep docs readable and maintainable.

## Recommended Action Updates (for next revision)
1. Add `job_id` to generation outputs and all dependent interfaces.
2. Split runtime into two entrypoints: API process and MCP process.
3. Add explicit security section for remote fetch constraints.
4. Replace base64 path route with query-based lookup endpoint.
5. Resolve all TBDs (UI framework, runtime wiring, test strategy).
6. Rework Increment 1 to include a minimal MCP tool path.

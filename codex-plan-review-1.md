# Review 1: Codex Plan — Claude's Assessment

## What Codex Got Right (Adopt These)

### 1. Full E2E vertical in M1
The user explicitly asked for "increments of value that are testable E2E." Codex delivers API + MCP + Storage + UI all in M1. My original plan sliced too thin — a core engine with no MCP or persistence isn't E2E testable in a meaningful way. **Lesson: a thin vertical slice beats a thick horizontal layer.**

### 2. Job abstraction over raw image records
Codex models each generation as an `og_job` with status tracking (`completed | failed`). This is smarter than a plain `images` table because:
- It naturally extends to async processing later
- It captures failures (agents need to know when something broke)
- It maps cleanly to CRUD API semantics (`POST /v1/og/jobs` = "create a job")

### 3. SVG text overlay instead of @napi-rs/canvas
Codex uses Sharp's built-in SVG composite for text rendering. This eliminates a native binary dependency (@napi-rs/canvas) that can cause build issues on different platforms. Sharp can composite an SVG buffer directly — no canvas needed. **Simpler dependency tree = fewer deployment headaches.**

### 4. Versioned API routes (`/v1/`)
If this becomes agent-facing infrastructure, breaking changes will happen. `/v1/og/jobs` is trivially future-proof. My plan used `/api/generate` with no versioning — short-sighted for a tool meant to be discovered and relied upon by agents.

### 5. Input validation with concrete limits
Codex specifies: fetch timeout 8s, max source 10MB, mime png/jpeg/webp, title max 140 chars, subtitle max 120 chars. My plan hand-waved validation. **Agents need structured error responses to self-correct.** A 400 with `{ code: "TITLE_TOO_LONG", max: 140 }` is actionable. A generic "invalid input" is not.

### 6. File upload support from day 1
My plan only accepted image URLs. But the user's workflow starts with AI-generated images that may be saved locally. Multipart file upload is essential — not a nice-to-have.

### 7. Comprehensive test scenarios specified upfront
Codex lists 10 API tests, 5 MCP tests, and 2 non-functional smoke tests before writing any code. My plan had vague "run a script" test descriptions. **Specifying test cases upfront forces you to think about edge cases before implementation.**

### 8. UI in M1, not deferred
The user said "Hopefully we can build a UI for seeing a library of work performed." Codex includes a server-rendered `/jobs` page in M1. My plan pushed UI to Increment 5 — ignoring a stated requirement.

---

## What Codex Got Wrong (Fix These)

### 1. Single platform size (1200x630 only)
The user's core problem is resizing for multiple social platforms. Codex locks to 1200x630 and defers multi-size to later. This misses the point — an agent should be able to say "size it for Twitter" and get 1200x675. **Multi-platform presets must be in M1.**

### 2. No MCP-first framing
Codex treats MCP as one of several interfaces. But the user's thesis — and the entire conversation leading to this plan — was that agents discovering tools via MCP registries is the primary distribution channel. The plan should explicitly address:
- Tool description quality (agent SEO)
- MCP Registry listing strategy
- Tool naming for discoverability
Codex's MCP section is mechanically correct but strategically shallow.

### 3. One template is too few for M1
While I agree that 4 templates in v1 was aggressive, shipping with zero template choice means agents can't express preference. **Two templates (e.g., `gradient-bottom` and `center-dark`) give agents meaningful choice without over-engineering.**

### 4. No mention of fonts
SVG text overlay still needs a font strategy. If the SVG references "Inter" but the system doesn't have it, rendering falls back to a default serif font. Codex doesn't address this. **Need to either bundle a font or use a web-safe fallback explicitly.**

### 5. Auth strategy is premature
Optional API key in M1 adds code paths and conditional logic before there's any user besides the builder. This is YAGNI — ship without auth, add it when there's a reason.

---

## What Neither Plan Addressed

1. **Image format flexibility** — Both default to PNG. WebP would be smaller and faster to serve. Should at least be an option.
2. **Base64 image return for MCP** — Agents can't open file paths. The MCP tool should return a base64 thumbnail or a servable URL, not just a local path.
3. **Idempotency** — If an agent calls `create_og_image` with the same inputs twice, should it return the cached result or create a duplicate? Codex's job model makes dedup possible but doesn't specify behavior.
4. **Cleanup / TTL** — No plan for old image cleanup. Output directory will grow forever.

---

## Merged Recommendation

Take Codex's M1 structure (full vertical slice, job model, versioned API, SVG rendering, validation, tests) and add:
- Multi-platform presets from Claude's plan
- 2 templates instead of 1 or 4
- MCP-first strategic framing (tool descriptions, registry prep)
- Font bundling for SVG reliability
- Base64 thumbnail in MCP responses
- Drop auth from M1

# FolioForge Pilot Runbook

## Goal
Use FolioForge blog posts as pilot traffic for the OG MCP/API service.

## Repos
- OG service: `../OG`
- Pilot app: `../FolioForge`

## Integration Strategy
1. Keep OG generation in `OG` service.
2. FolioForge requests OG image per blog post from OG API.
3. FolioForge stores returned `imageUrl` and sets `og:image` + `twitter:image`.

## Local Ports (Suggested)
- OG API/UI: `4010`
- FolioForge dev: existing FolioForge dev port

## FolioForge Integration Points Already Identified
- `../FolioForge/client/src/pages/blog-post.tsx`
- `../FolioForge/client/src/components/SEOHead.tsx`
- `../FolioForge/server/vite.ts`

## Minimal Pilot Flow
1. User creates/edits blog post in FolioForge.
2. FolioForge calls `POST /v1/og/jobs` with:
   - `title`
   - `subtitle` (optional)
   - `source_image_url` or upload/base64
   - `platform=og`
   - `template_id=gradient-bottom`
   - `page_url` (blog post URL)
   - header `x-api-key: <OG_API_KEY>`
3. OG service returns `imageUrl`.
4. FolioForge writes `og:image` and `twitter:image` to that URL.

## Env Wiring in FolioForge
- `OG_API_BASE_URL=http://localhost:4010`
- `OG_API_KEY=<internal product key>` (required when `REQUIRE_API_KEY=true` on OG service)

## Acceptance Checks
1. Create 3 test blog posts.
2. Confirm each has distinct OG image URL.
3. Confirm `/v1/og/mappings/by-url?url=<post-url>` resolves correctly.
4. Confirm social previews render via platform inspectors.

## Notes
For v1 pilot, keep asset inputs origin-agnostic:
- URL input
- base64 input
- multipart upload

No file-path assumptions should be required from agent callers.

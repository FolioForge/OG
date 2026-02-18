# OG Image Generator

MCP-first OG image generator for AI agents.

## Tech Stack
- Node.js + TypeScript (ESM)
- Sharp for image processing
- @napi-rs/canvas for text rendering
- @modelcontextprotocol/sdk for MCP server
- Fastify for REST API
- better-sqlite3 for persistence

## Commands
- `npm run dev` — Start API + MCP server
- `npm run test:e2e` — Run E2E engine test
- `npm run mcp` — Start MCP server (stdio)
- `npm run build` — Compile TypeScript

## Project Structure
- `src/core/` — Shared engine (presets, templates, text overlay, orchestrator)
- `src/mcp/` — MCP server with tool definitions
- `src/api/` — Fastify REST API
- `src/storage/` — SQLite + filesystem
- `fonts/` — Bundled Inter font files
- `output/` — Generated images (gitignored)
- `test/e2e/` — End-to-end test scripts

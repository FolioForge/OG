# Human Owner Checklist

## Accounts and Billing
1. Create hosting account (Render/Railway/Vercel alternative).
2. Create Cloudflare account for DNS and domain.
3. Create object storage account (R2 or S3) for production images.
4. Set budget caps and billing alerts.

## Domain and DNS
1. Buy/assign your production domain.
2. Configure `api.<domain>` for OG API.
3. Configure future `mcp.<domain>` for remote MCP.
4. Verify HTTPS certificates.

## Brand Inputs
1. Provide default blank template image(s).
2. Provide logo files (SVG preferred, PNG fallback).
3. Provide default hex palette (`primary`, `accent`, `text`).
4. Approve two v1 templates and text hierarchy.

## Product Decisions
1. Retention policy for generated images (30/90/unlimited days).
2. Allowed content policy.
3. Abuse and rate-limit policy.
4. Pricing model and free-tier limits.

## Pilot Inputs (FolioForge)
1. Share 10 real blog posts (title + URL).
2. Define visual acceptance criteria (good/bad examples).
3. Confirm success metrics:
   - Success rate target
   - Latency target
   - Manual edits target
   - Time-saved target

## Launch Ops
1. Register MCP listing metadata and docs.
2. Publish install instructions for desktop/dev MCP clients.
3. Generate API keys for each internal product and outsider cohort.
4. Set key rotation cadence (monthly/quarterly) and revocation process.
5. Set error alerting and uptime checks.
6. Run one-week pilot and review KPI report.

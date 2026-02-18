# Enterprise Setup (Managed by You)

## Goal
Run one hosted OG service for multiple personal products while rate-limiting outsider access.

## 1) Generate API Keys
Use one internal key per product and one outsider key for public access.

```bash
npm run gen:api-key -- folioforge internal
npm run gen:api-key -- anotherproduct internal
npm run gen:api-key -- public outsider
```

## 2) Configure Environment
Example:

```env
REQUIRE_API_KEY=true
API_KEYS=folioforge:ogk_xxx:internal,anotherproduct:ogk_yyy:internal,public:ogk_zzz:outsider
INTERNAL_RATE_LIMIT_PER_MINUTE=0
OUTSIDER_RATE_LIMIT_PER_MINUTE=60
ANONYMOUS_RATE_LIMIT_PER_MINUTE=10
```

## 3) Deploy
1. Push repo to GitHub.
2. Create Render service from repo using `render.yaml`.
3. Add env vars and persistent disk.
4. Set `PUBLIC_BASE_URL` to your HTTPS domain.

## 4) Connect Products
For each product:
1. Set product env `OG_API_BASE_URL=https://api.<your-domain>`.
2. Set product env `OG_API_KEY=<its internal key>`.
3. Send requests with `x-api-key` header.

## 5) Outsider Access
Use outsider key in external clients. Requests are throttled via `OUTSIDER_RATE_LIMIT_PER_MINUTE`.

## 6) Validation
1. `GET /healthz` confirms auth mode and key count.
2. `POST /v1/og/jobs` with valid internal key returns `201`.
3. Repeated outsider calls return `429` after limit.

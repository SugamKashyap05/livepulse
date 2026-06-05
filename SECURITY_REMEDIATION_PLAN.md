# LivePulse Security Remediation Plan

Created: 2026-06-02

Source: `SECURITY_REPORT.md`

Goal: close the confirmed security gaps in priority order, then re-run the same verification checks from the report.

Status update: 2026-06-03

- Phases 1, 2, 3, and the local part of Phase 5 are complete.
- Phase 4 remains a manual production check in Vercel.
- Authenticated DB-backed smoke tests reached route logic but returned `500` because the local process could not reach the Neon database host. Unauthenticated checks prove the security gates now fail closed.

## Priority Order

1. Lock down public admin-context AI endpoints.
2. Add defense-in-depth auth to proxy-dependent destructive admin routes.
3. Add production security headers.
4. Verify production environment variables.
5. Re-run the security audit checks and update `SECURITY_REPORT.md`.

## Phase 1 — Critical Auth Fixes

Risk: confirmed unauthenticated `200` responses on endpoints that expose admin/system context.

Status: complete.

### Fix 1.1 — Protect `/api/ai/manager`

File: `src/app/api/ai/manager/route.ts`

Current finding:

- Route is outside `/api/admin/*`.
- No local admin auth check.
- Local unauthenticated `POST /api/ai/manager` returned `200`.
- It exposes admin/system context: total article count, topic counts, last sync, recent AI logs.

Implementation:

```ts
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // existing logic
}
```

Verification:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Method Post `
  -ContentType "application/json" `
  -Body '{ "messages": [{ "role": "user", "content": "status" }] }' `
  http://127.0.0.1:3000/api/ai/manager
```

Verified unauthenticated result: `401`.

Expected authenticated result:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Method Post `
  -Headers @{ Authorization = "Bearer <ADMIN_SECRET>" } `
  -ContentType "application/json" `
  -Body '{ "messages": [{ "role": "user", "content": "status" }] }' `
  http://127.0.0.1:3000/api/ai/manager
```

Verified authenticated result: request passed auth but returned `500` because Prisma could not reach Neon. Re-run when database connectivity is available; it must not return `401` with valid admin auth.

### Fix 1.2 — Protect `/api/ai/newsroom/activity`

File: `src/app/api/ai/newsroom/activity/route.ts`

Current finding:

- Route is outside `/api/admin/*`.
- No local admin auth check.
- Local unauthenticated `GET /api/ai/newsroom/activity` returned `200`.
- It exposes recent agent activity records.

Implementation option A, minimal:

```ts
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // existing logic
}
```

Also update callers:

- `src/components/admin/NewsroomClient.tsx`
  - Current activity path likely calls `/api/ai/newsroom/activity`.
  - If keeping the same route, no path change is needed.

Implementation option B, cleaner route shape:

- Create `src/app/api/admin/ai/newsroom/activity/route.ts`.
- Move handler there.
- Keep the auth check.
- Update `NewsroomClient` polling and deploy refresh calls from `/api/ai/newsroom/activity` to `/api/admin/ai/newsroom/activity`.
- Optionally leave old `/api/ai/newsroom/activity` as a `410 Gone` or `401`.

Chosen implementation: Option B.

- Added `src/app/api/admin/ai/newsroom/activity/route.ts`.
- Updated `src/components/admin/NewsroomClient.tsx` to call `/api/admin/ai/newsroom/activity`.
- Changed old `/api/ai/newsroom/activity` to require admin auth and return `410` after auth.

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/ai/newsroom/activity
```

Expected if keeping route: `401`.

Verified after moving route:

- Old route without auth: `401`.
- New admin route without auth: `401`.
- New admin route with auth: passed auth but returned `500` because Prisma could not reach Neon.

## Phase 2 — Defense In Depth For Admin Routes

Risk: current protection works through `src/proxy.ts`, but destructive route handlers should fail closed even if proxy config changes.

Status: complete.

### Fix 2.1 — Add local auth to `/api/admin/articles`

File: `src/app/api/admin/articles/route.ts`

Current finding:

- No local `isAdminAuthorized()` call.
- Route is protected by `/api/admin/:path*` proxy matcher.
- Local unauthenticated `DELETE /api/admin/articles` returned `401`, proving proxy works.

Implementation:

```ts
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function DELETE(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // existing logic
}
```

Keep the existing `confirm=true` guard for full deletion.

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Delete http://127.0.0.1:3000/api/admin/articles
```

Verified unauthenticated result: `401`.

Authenticated without target:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Method Delete `
  -Headers @{ Authorization = "Bearer <ADMIN_SECRET>" } `
  http://127.0.0.1:3000/api/admin/articles
```

Verified authenticated result without target: `400`, not deletion.

Authenticated full delete:

- Do not run against real data unless intentionally purging.
- If tested, use a temporary isolated database or seed a disposable row first.
- Requires `?confirm=true`.

## Phase 3 — Security Headers

Risk: browser-level protections are absent.

Status: complete.

### Fix 3.1 — Add global headers in `next.config.ts`

File: `next.config.ts`

Headers to add:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`

Suggested first-pass CSP:

```text
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' http://localhost:11434 https:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Notes:

- The app currently uses inline styles and Next dev tooling, so CSP needs `'unsafe-inline'` and dev may need `'unsafe-eval'`.
- For production, remove or tighten `'unsafe-eval'` if Next build allows it.
- `connect-src` includes local Ollama and HTTPS APIs.

Implementation shape:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "..." },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}
```

Verification:

```powershell
$r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/
$r.Headers["X-Content-Type-Options"]
$r.Headers["Referrer-Policy"]
$r.Headers["Permissions-Policy"]
$r.Headers["X-Frame-Options"]
$r.Headers["Content-Security-Policy"]
```

Verified:

- All values present.
- Page returned `200`.
- Header values were present on `/`.
- Browser console check was not run in this pass.

## Phase 4 — Production Environment Verification

Risk: local `.env` has required secrets, but production safety depends on Vercel env vars.

Status: pending manual verification.

### Fix 4.1 — Verify Vercel variables manually

Required production variables:

```text
DATABASE_URL
ADMIN_SECRET
CRON_SECRET
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
NEXT_PUBLIC_BASE_URL
OLLAMA_MODEL
OLLAMA_DIGEST_MODEL
OLLAMA_SUMMARY_MODEL
OLLAMA_CHAT_MODEL
OLLAMA_MANAGER_MODEL
OLLAMA_FAST_MODEL
```

Do not set `OLLAMA_HOST` on Vercel unless using a reachable hosted Ollama endpoint.

Verification:

- In Vercel Dashboard → Project → Settings → Environment Variables:
  - Confirm `ADMIN_SECRET` exists.
  - Confirm `CRON_SECRET` exists.
  - Confirm Neon Auth variables exist.
  - Confirm `DATABASE_URL` points to Neon PostgreSQL, not SQLite.

### Fix 4.2 — Verify cron behavior after deploy

After deployment:

Unauthenticated sync:

```powershell
Invoke-WebRequest https://<vercel-domain>/api/sync
```

Expected: `401` if Vercel production has `CRON_SECRET`.

Authenticated sync:

```powershell
Invoke-WebRequest `
  -Headers @{ Authorization = "Bearer <CRON_SECRET>" } `
  https://<vercel-domain>/api/sync
```

Expected: `200`.

## Phase 5 — Re-Audit And Report Update

After implementing Phases 1-4, update `SECURITY_REPORT.md`.

Status: local re-audit complete; production env verification remains pending.

### Required local checks

```powershell
npx tsc --noEmit
```

Unauthenticated endpoint checks:

```powershell
# Admin page should redirect
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/admin -MaximumRedirection 0

# Admin API should reject
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/api/admin/ping?url=http://localhost"

# Destructive admin articles should reject
Invoke-WebRequest -UseBasicParsing -Method Delete http://127.0.0.1:3000/api/admin/articles

# Batch should reject
Invoke-WebRequest -UseBasicParsing -Method Post -ContentType "application/json" -Body "{}" http://127.0.0.1:3000/api/ai/batch

# Newsroom process should reject
Invoke-WebRequest -UseBasicParsing -Method Post -ContentType "application/json" -Body "{}" http://127.0.0.1:3000/api/ai/newsroom/process

# Manager should reject after Phase 1
Invoke-WebRequest -UseBasicParsing -Method Post -ContentType "application/json" -Body '{ "messages": [] }' http://127.0.0.1:3000/api/ai/manager

# Newsroom activity should reject after Phase 1
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/ai/newsroom/activity

# User-only APIs should reject
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/user/bookmarks
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/api/feed?scope=bookmarks
```

Expected results:

```text
/admin -> 307
/api/admin/ping -> 401
/api/admin/articles DELETE -> 401
/api/ai/batch POST -> 401
/api/ai/newsroom/process POST -> 401
/api/ai/manager POST -> 401
/api/ai/newsroom/activity GET -> 401, 404, or 410 depending on chosen route strategy
/api/user/bookmarks GET -> 401
/api/feed?scope=bookmarks GET -> 401
```

Header checks:

```powershell
$r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/
$r.Headers["Content-Security-Policy"]
$r.Headers["X-Frame-Options"]
$r.Headers["X-Content-Type-Options"]
$r.Headers["Referrer-Policy"]
$r.Headers["Permissions-Policy"]
```

Expected:

- All headers present.

## Acceptance Criteria

The security remediation is complete when:

- `POST /api/ai/manager` returns `401` without admin auth. Complete.
- `GET /api/ai/newsroom/activity` no longer returns public `200`. Complete.
- `DELETE /api/admin/articles` has an independent local auth check and still returns `401` without auth. Complete.
- Full article delete still requires `confirm=true`. Complete; authenticated no-target delete returned `400`.
- Global security headers are present on `/`. Complete.
- `npx tsc --noEmit` passes. Complete.
- `SECURITY_REPORT.md` is updated so the previous gaps are marked fixed or reclassified. Complete.
- Vercel env vars are manually verified, especially `CRON_SECRET`. Pending manual check.

## Recommended Commit Scope

Use one atomic security commit:

```text
security: close admin ai gaps and add browser hardening
```

Include:

- Auth guard for manager route.
- Auth guard or move for newsroom activity route.
- Local auth guard for admin articles delete.
- Security headers.
- Updated `SECURITY_REPORT.md`.
- Updated `knowldge.md`.

Do not include unrelated lint cleanup, UI redesign, feed source changes, or AI model changes in this commit.

## Gap Update Addendum - 2026-06-03

Source: security gap update brief reviewed against current source.

### Fix 1.3 - Protect `/api/ai/batch`

Status: complete.

File: `src/app/api/ai/batch/route.ts`

Implementation:

```ts
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
```

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  -ContentType "application/json" `
  -Body '{ "task": "all", "limit": 100 }' `
  http://127.0.0.1:3000/api/ai/batch
```

Expected: `401` unauthenticated.

### Fix 1.4 - Digest model env var consistency

Status: complete.

File: `src/app/api/ai/digest/route.ts`

Implementation:

```ts
const model = process.env.OLLAMA_DIGEST_MODEL || "llama3"
```

Verification:

```powershell
rg -n "OLLAMA_MODEL_DIGEST" src
```

Expected: zero results.

### Fix 1.5 - Ensure search only returns published articles

Status: complete.

File: `src/app/api/search/route.ts`

Implementation:

```ts
const articles = await prisma.newsArticle.findMany({
  where: {
    published: true,
    OR: [
```

Verification:

```powershell
Get-Content -Raw src/app/api/search/route.ts
```

Expected: `published: true` is present in the public search query.

### Fix 2.2 - Guard all user routes against null userId

Status: complete.

Files:

- `src/app/api/user/bookmarks/route.ts`
- `src/app/api/user/read/route.ts`
- `src/app/api/user/preferences/route.ts`

Implementation:

- Bookmarks GET/POST/DELETE already returned `401` without `userId`.
- Preferences GET/POST already returned `401` without a Neon Auth user.
- Read tracking now returns `401` instead of silently succeeding for anonymous callers.

Current pattern:

```ts
const userId = await getMutableCurrentUserId()
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  -ContentType "application/json" `
  -Body '{ "articleId": "test" }' `
  http://127.0.0.1:3000/api/user/read
```

Expected: `401` without a signed-in user.

### Fix 2.3 - Verify seed-sources auth

Status: complete.

File: `src/app/api/admin/seed-sources/route.ts`

Implementation:

```ts
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
```

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  http://127.0.0.1:3000/api/admin/seed-sources
```

Expected: `401` unauthenticated.

### Fix 6.1 - Add rate limiting to public AI routes

Status: deferred post-launch hardening.

Routes:

- `POST /api/ai/chat`
- `POST /api/ai/summarize`
- `POST /api/ai/sentiment`
- `POST /api/ai/tag`

Recommended production implementation:

- Use a serverless-safe store such as Upstash Redis plus `@upstash/ratelimit`.
- Rate limit by IP and, when available, authenticated user id.
- Return `429` with a small JSON error body.

Do not use a plain in-memory `Map` for production Vercel enforcement because it resets on cold starts and does not coordinate across regions/instances.

### Fix 6.2 - Admin auth hardening

Status: short-term delay complete; session-token replacement deferred.

File: `src/app/api/admin/auth/route.ts`

Short-term implementation:

```ts
const AUTH_RESPONSE_DELAY_MS = 100

function delayAuthResponse() {
  return new Promise((resolve) => {
    setTimeout(resolve, AUTH_RESPONSE_DELAY_MS)
  })
}
```

The handler awaits the fixed delay before configured `500`, failed `401`, and successful `200` responses.

Medium-term deferred work:

- Replace the raw `ADMIN_SECRET` cookie value with a signed random session token.
- Keep `ADMIN_SECRET` as the login credential only, not the session credential.
- Prefer a real admin role through Neon Auth or another identity provider when admin multi-user support is needed.

### Fix 6.3 - RSS prompt injection mitigations

Status: short-term length caps complete; pattern detection deferred.

Files:

- `src/lib/fetchFeeds.ts`
- `src/lib/agents.ts`

Current short-term mitigation:

- RSS descriptions strip HTML and are capped to 200 chars in `cleanDescription()`.
- Scout prompt snippets cap descriptions to 150 chars.
- These caps are stricter than the requested 500/200 caps.

Deferred medium-term pattern filter:

```ts
const INJECTION_PATTERNS = [
  /ignore (previous|all) instructions/i,
  /system prompt/i,
  /\[INST\]/i,
  /<\|.*\|>/i,
]
```

Recommended behavior: discard or blank only the suspicious description while preserving title/source metadata.

### Operational Fix - AutoSync bootstrap race

Status: complete.

File: `src/lib/autoSync.ts`

Implementation:

- AutoSync imports sync dependencies and calls `fetchFeedsWithStatus()` directly.
- It upserts through Prisma in-process.
- It no longer fetches `/api/sync` over HTTP, so it does not race the Next dev server binding port 3000.

Verification:

```powershell
rg -n "localhost:3000|/api/sync|BASE_URL" src/lib/autoSync.ts
```

Expected: zero self-HTTP sync calls.

### Resolved - `/api/ai/newsroom/process`

Status: complete.

File: `src/app/api/ai/newsroom/process/route.ts`

Resolution:

- `isAdminAuthorized(request)` is present at the top of the `POST` handler.
- Unauthenticated requests are expected to return `401`.

## Additional Acceptance Criteria From Gap Update

- `POST /api/ai/batch` returns `401` without admin auth.
- `GET /api/search` returns only `published: true` articles.
- `GET/POST /api/user/bookmarks` returns `401` when Neon Auth is not configured or no user is signed in.
- `POST /api/user/read` returns `401` when Neon Auth is not configured or no user is signed in.
- `POST /api/admin/seed-sources` returns `401` without admin auth.
- `rg -n "OLLAMA_MODEL_DIGEST" src` returns zero results.
- RSS descriptions are capped before insertion into Ollama prompts; current feed cap is 200 chars.
- `SECURITY_REPORT.md` marks `/api/ai/newsroom/process` as resolved with file and verification command.
- New batch, rate limiting, brute force, prompt injection, search filter, user null guard, autosync race, and seed-sources items are documented with severity, file location, and verification.

## Updated Recommended Commit Scope

Use one atomic commit:

```text
security: close remaining auth gaps + harden inputs
```

Include:

- Auth guard verification for `/api/ai/batch`.
- Digest env var verification.
- `published: true` search verification.
- Null-user guard for `/api/user/read`.
- Seed-sources auth verification.
- Admin auth fixed response delay.
- RSS description length-cap verification.
- `/api/ai/newsroom/process` resolved status.
- Updated `SECURITY_REPORT.md`.
- Updated `SECURITY_REMEDIATION_PLAN.md`.
- Updated `knowldge.md`.

Deferred post-launch:

- Rate limiting on public AI routes.
- Admin session token replacement.
- Prompt injection pattern detection.

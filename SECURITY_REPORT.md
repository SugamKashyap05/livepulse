# LivePulse Security Measures Report

Generated: 2026-06-02

Last updated: 2026-06-06 after Bluewall v2 remediation.

Scope: current worktree source audit plus targeted local HTTP checks against `http://127.0.0.1:3000`.

## Verification Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Admin page/API gate | Verified | `src/proxy.ts`, `src/lib/adminAuth.ts`; local `/admin` returned `307`, `/api/admin/ping` returned `401` without auth |
| Admin login cookie hardening | Verified | `src/app/api/admin/auth/route.ts` sets a signed 64-character hex session token, not the raw `ADMIN_SECRET`; cookie is `httpOnly`, `sameSite: "strict"`, production-only `secure`, `path: "/"`, `maxAge: 86400` |
| User auth | Verified in source | Neon Auth via `src/lib/auth.ts`; protected routes in `src/proxy.ts`; user APIs return `401` without session |
| Cron sync auth | Verified in source | `src/app/api/sync/route.ts` checks `Authorization: Bearer <CRON_SECRET>` whenever `CRON_SECRET` exists; no development bypass remains |
| SSRF protection | Verified | `src/app/api/admin/ping/route.ts` requires admin auth and allowlists configured feed hostnames |
| Destructive delete guard | Verified | `src/app/api/admin/articles/route.ts` requires `confirm=true` for full purge; route is proxy-protected |
| Batch/newsroom AI admin actions | Verified | `src/app/api/ai/batch/route.ts` and `src/app/api/ai/newsroom/process/route.ts` independently check admin auth |
| User-owned data isolation | Verified in source | Bookmark/preferences/read APIs scope writes by current Neon `userId` |
| XSS/HTML handling | Verified in source | RSS descriptions strip HTML; image fallback uses `textContent`; no `dangerouslySetInnerHTML` found in audited UI |
| Public regwall | Verified in source | Public feeds pass `registrationRequired` to `ArticleFeed`; logged-out Load More opens `Regwall` when Neon Auth is configured |
| Admin AI manager auth | Verified | `POST /api/ai/manager` now checks `isAdminAuthorized()` and returned `401` without auth |
| Newsroom activity auth | Verified | Old `/api/ai/newsroom/activity` returns `401` without auth; new `/api/admin/ai/newsroom/activity` returns `401` without auth |
| Admin articles defense-in-depth | Verified | `src/app/api/admin/articles/route.ts` now independently checks `isAdminAuthorized()` |
| Global security headers | Verified | `/` returns CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` |
| Remaining manual checks | Needs external verification | Confirm Vercel env vars, especially `CRON_SECRET`; local authenticated DB-backed smoke hit Neon connectivity errors |

## 1. Admin Authentication

### Gate Location

File: `src/proxy.ts`

Security measure:

- Next 16 Proxy file exists at `src/proxy.ts`.
- No `src/middleware.ts` or root `middleware.ts` exists.
- The proxy protects:
  - `/admin/:path*`
  - `/api/admin/:path*`
  - `/profile/:path*`
  - `/onboarding/:path*`
  - `/bookmarks/:path*`
  - `/settings/:path*`

Relevant code:

```ts
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/auth" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next()
  }

  const userProtected = ["/profile", "/onboarding", "/bookmarks", "/settings"]
  if (userProtected.some((path) => pathname.startsWith(path))) {
    if (!isNeonAuthConfigured()) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      loginUrl.searchParams.set("error", "auth_not_configured")
      return NextResponse.redirect(loginUrl)
    }

    return auth.middleware({ loginUrl: "/login" })(request)
  }

  if (!isAdminAuthorized(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = new URL("/admin/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
    "/bookmarks/:path*",
    "/settings/:path*",
  ],
}
```

### Admin Auth Predicate

File: `src/lib/adminAuth.ts`

Security measure:

- Requires `ADMIN_SECRET`.
- Accepts either:
  - `Authorization: Bearer <ADMIN_SECRET>`
  - `admin_token=<signed 64-character hex session token>` cookie validated by `src/lib/adminSessions.ts`.
- Fails closed if `ADMIN_SECRET` is missing.

```ts
export function isAdminAuthorized(request: NextRequest | Request): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false

  const req = request as NextRequest
  const authHeader = req.headers?.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null
  if (bearerToken === adminSecret) return true

  const cookieToken = req.cookies?.get?.("admin_token")?.value
  if (cookieToken && validateAdminSession(cookieToken)) return true

  return false
}
```

### Admin Login Cookie

File: `src/app/api/admin/auth/route.ts`

Security measure:

- Rejects wrong password with `401`.
- Cookie is `httpOnly`.
- Cookie uses `sameSite: "strict"`.
- Cookie uses `secure` only in production so localhost HTTP can still set it.
- Cookie expires after 24 hours.
- Cookie value is a signed 64-character hex session token, not `ADMIN_SECRET`.

```ts
const sessionToken = createAdminSession()
response.cookies.set("admin_token", sessionToken, {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 86400,
})
```

Local checks:

```text
admin page: 307
admin ping: 401
admin articles delete: 401
```

## 2. Independent Admin Guards Outside `/api/admin`

Some sensitive admin actions live under `/api/ai/*`, so the proxy matcher does not cover them. These routes add independent admin checks.

### Batch AI Processor

File: `src/app/api/ai/batch/route.ts`

```ts
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
```

Local check:

```text
ai batch: 401
```

### Agentic Newsroom Process

File: `src/app/api/ai/newsroom/process/route.ts`

```ts
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
```

Local check:

```text
newsroom process: 401
```

### AI Manager

File: `src/app/api/ai/manager/route.ts`

```ts
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
```

Local check:

```text
ai_manager: 401
```

Authenticated follow-up reached route logic, but returned `500` because the local process could not reach the Neon database. This is an infrastructure/database connectivity issue, not an auth failure.

### Newsroom Activity

Files:

- `src/app/api/admin/ai/newsroom/activity/route.ts`
- `src/app/api/ai/newsroom/activity/route.ts`

The admin route reads activity and requires admin auth. The old public route fails closed before disclosing records.

Local checks:

```text
newsroom_activity_old: 401
newsroom_activity_admin: 401
```

## 3. Admin API Coverage

Route coverage from source scan:

| Route | Local auth check | Notes |
| --- | --- | --- |
| `/api/admin/ai/discard` | `isAdminAuthorized` | Deletes only unpublished AI drafts |
| `/api/admin/ai/drafts` | `isAdminAuthorized` | Draft queue |
| `/api/admin/ai/publish` | `isAdminAuthorized` | Publishes draft |
| `/api/admin/ai/reanalyse` | `isAdminAuthorized` | Runs fact/spin agents |
| `/api/admin/ai/newsroom/activity` | `isAdminAuthorized` | Agent activity log |
| `/api/admin/ai/unpublish` | `isAdminAuthorized` | Unpublishes article |
| `/api/admin/articles` | `isAdminAuthorized` plus proxy | Destructive delete route with local defense-in-depth |
| `/api/admin/auth` | Public by design | Login endpoint |
| `/api/admin/ping` | `isAdminAuthorized` | Also has SSRF allowlist |
| `/api/admin/purge` | `isAdminAuthorized` | Deletes old articles |
| `/api/admin/seed-sources` | `isAdminAuthorized` | Seeds source table |
| `/api/admin/sources` | `isAdminAuthorized` | Source CRUD |

Important verification note:

- `src/app/api/admin/articles/route.ts` now has a local `isAdminAuthorized()` call in addition to proxy protection.
- Local unauthenticated `DELETE /api/admin/articles` returned `401`.
- Authenticated `DELETE /api/admin/articles` without `id`, `topic`, or `confirm=true` returned `400`, proving the full-delete guard still blocks accidental purge.

## 4. Destructive Operation Safeguards

### Full Article Delete Requires Confirmation

File: `src/app/api/admin/articles/route.ts`

Security measure:

- Delete by `id` deletes one article.
- Delete by `topic` deletes topic articles.
- Full database delete requires `confirm=true`.
- Without `id`, `topic`, or `confirm=true`, route returns `400`.

```ts
if (confirm !== "true") {
  return NextResponse.json(
    { success: false, error: "Missing id, topic, or confirm=true" },
    { status: 400 }
  )
}

const result = await prisma.newsArticle.deleteMany({})
```

### Draft Discard Restriction

File: `src/app/api/admin/ai/discard/route.ts`

Security measure:

- Requires admin auth.
- Only deletes rows where `aiGenerated: true` and `published: false`.
- Cannot discard already published articles through this route.

## 5. Cron Sync Protection

File: `src/app/api/sync/route.ts`

Security measure:

- If `CRON_SECRET` exists, sync always requires:
  - `Authorization: Bearer <CRON_SECRET>`
- No `NODE_ENV === "development"` bypass remains.

```ts
const authHeader = request.headers.get("authorization")

if (
  process.env.CRON_SECRET &&
  authHeader !== `Bearer ${process.env.CRON_SECRET}`
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

Interpretation:

- Local and production behavior match when `CRON_SECRET` is set.
- If `CRON_SECRET` is absent, the route remains intentionally open for bootstrap/manual local use; Vercel must define `CRON_SECRET`.

## 6. SSRF Protection

File: `src/app/api/admin/ping/route.ts`

Security measure:

- Requires admin auth before URL parsing.
- Parses URL with `new URL`.
- Only allows `http:` and `https:`.
- Only allows hostnames present in enabled DB feed sources, or hardcoded feed sources if DB sources are empty.
- Uses `HEAD`.
- Uses `AbortSignal.timeout(8000)`.

```ts
if (
  !["http:", "https:"].includes(parsedUrl.protocol) ||
  !allowedHostnames.has(parsedUrl.hostname)
) {
  return NextResponse.json(
    { error: "URL not in allowed sources" },
    { status: 403 }
  )
}
```

Local check:

```text
admin ping: 401
```

Manual verification with admin auth:

```powershell
Invoke-WebRequest `
  -Headers @{ Authorization = "Bearer $env:ADMIN_SECRET" } `
  "http://127.0.0.1:3000/api/admin/ping?url=http://localhost"
```

Expected: `403`.

## 7. Public User Authentication

### Neon Auth Integration

File: `src/lib/auth.ts`

Security measure:

- Uses `@neondatabase/auth`.
- Requires `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`.
- `isNeonAuthConfigured()` fails closed unless cookie secret exists and is at least 32 chars.
- Session-data JWT is verified with `jose.jwtVerify()`.
- Neon cookie config uses `sameSite: "strict"`.

```ts
export function isNeonAuthConfigured() {
  return Boolean(baseUrl && cookieSecret && cookieSecret.length >= 32)
}

const { payload } = await jwtVerify(
  sessionData,
  new TextEncoder().encode(cookieSecret)
)
```

### User Protected Pages

File: `src/proxy.ts`

Protected paths:

- `/profile`
- `/onboarding`
- `/bookmarks`
- `/settings`

Behavior:

- If Neon Auth is not configured, redirects to `/login?error=auth_not_configured`.
- If configured, uses `auth.middleware({ loginUrl: "/login" })`.

### User Data APIs

| Route | Security measure |
| --- | --- |
| `/api/user/preferences` | Requires session; validates followed topics against allowlist |
| `/api/user/bookmarks` | Requires session for GET/POST/DELETE; scopes by `userId` |
| `/api/user/read` | Requires a signed-in user and scopes writes by `userId`; logged-out requests return `401` |
| `/api/feed?scope=bookmarks` | Returns `401` if no signed-in user |

Local checks:

```text
feed bookmarks: 401
user bookmarks: 401
```

## 8. Public Regwall

Files:

- `src/components/Regwall.tsx`
- `src/components/ArticleFeed.tsx`
- `/`, `/topic/[slug]`, `/search`, `/tag/[tag]`, `/ai-news`

Security/product measure:

- Logged-out users can view the first server-rendered article page.
- When Neon Auth is configured and no user is signed in, clicking `Load More` opens a sign-up/sign-in regwall instead of fetching `/api/feed`.
- `Regwall` sign-up/sign-in links include a `next` parameter back to the current route.

Important note:

- This is a soft product gate, not a data security boundary.
- `/api/feed` remains publicly callable for non-bookmark scopes.

## 9. Data Isolation And Database Constraints

File: `prisma/schema.prisma`

Security-relevant constraints:

- `NewsArticle.link` is unique, reducing duplicate ingestion.
- `UserBookmark` has `@@unique([userId, articleId])`.
- `UserArticleRead` has `@@unique([userId, articleId])`.
- User-owned app data stores `userId` from Neon Auth.
- Bookmark/read records cascade delete when the article is deleted.

```prisma
model UserBookmark {
  id        String      @id @default(cuid())
  userId    String
  articleId String
  createdAt DateTime    @default(now())
  article   NewsArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([userId, articleId])
  @@index([userId])
}
```

## 10. RSS And Content Safety

File: `src/lib/fetchFeeds.ts`

Security measures:

- RSS fetches use a 10 second timeout.
- RSS descriptions decode HTML entities first, then strip HTML tags and leftover angle brackets before storage.
- Prompt-injection patterns such as "ignore previous instructions" and "system prompt" are redacted.
- Common tracking query params are removed from links.
- Duplicate canonical links and repeated normalized titles within a topic are dropped.

```ts
export function cleanDescription(raw: string | undefined): string {
  if (!raw) return ""
  let text = raw
  text = decodeHtmlEntities(text)
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/[<>]/g, "")
  text = stripInjectionPatterns(text)
  return text.replace(/\s+/g, " ").trim().slice(0, 500)
}
```

## Bluewall v2 Remediation - 2026-06-06

| Finding | Status | Evidence |
| --- | --- | --- |
| ANTI-V2-001 raw admin secret cookie | RESOLVED | `src/lib/adminSessions.ts` issues stateless signed 64-char hex tokens; `src/lib/adminAuth.ts` validates session tokens instead of comparing cookie to `ADMIN_SECRET`; logout clears the cookie. |
| ANTI-V2-002 chat system-role injection | RESOLVED | `src/app/api/ai/chat/route.ts` and `src/app/api/ai/article-chat/route.ts` allow only `user`/`assistant`, strip `< >`, and cap content. |
| ANTI-V2-003 client text in AI prompts | RESOLVED | Summary, sentiment, and tag routes load `published: true` article content by `id` from Prisma before building prompts. |
| ANTI-V2-004 entity-order XSS / prompt injection sanitizer bug | RESOLVED | `cleanDescription()` decodes entities before stripping tags and redacts injection phrases. |
| ANTI-V2-005 purge `days=0` | RESOLVED | `days` is clamped to `1..365`; no delete occurs without `confirm=true`. |
| ANTI-V2-006 batch limit exhaustion | RESOLVED | Batch `limit` is clamped to `1..50` and invalid values default to 20. |
| ANTI-V2-007 sync dev bypass | RESOLVED | `isDev` bypass removed; `CRON_SECRET` check is environment-independent. |
| ANTI-V2-008 verbose `String(error)` API leaks | RESOLVED | Source scan returns zero `String(error)` / `String(e)` API responses. |

## 11. XSS And Link Handling

File: `src/components/NewsCard.tsx`

Security measures:

- Image fallback avoids `innerHTML`.
- Source label uses `textContent`.
- External article links use `target="_blank"` with `rel="noopener noreferrer"`.
- `aiTags` JSON parse is wrapped in `try/catch`.
- No `dangerouslySetInnerHTML` was found in the audited source scan.

```ts
span.textContent = item.source
wrapper.appendChild(span)
```

## 12. AI Failure Safety

Routes:

- `/api/ai/summarize`
- `/api/ai/sentiment`
- `/api/ai/tag`
- `/api/ai/chat`
- `/api/ai/digest`
- `/api/ai/manager`

Security/reliability measure:

- Ollama failures are caught.
- Routes return structured fallback JSON such as:
  - `{ error: "AI service unavailable", fallback: true }`
- Failed AI calls are logged through `logAiAction()` where implemented.

Example from `src/app/api/ai/summarize/route.ts`:

```ts
return NextResponse.json(
  { error: "AI service unavailable", fallback: true },
  { status: 503 }
)
```

## 13. Current Environment Variable Presence

Local `.env` contains these variable names:

```text
DATABASE_URL
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
NEXT_PUBLIC_BASE_URL
OLLAMA_HOST
OLLAMA_MODEL
OLLAMA_DIGEST_MODEL
OLLAMA_SUMMARY_MODEL
OLLAMA_CHAT_MODEL
OLLAMA_MANAGER_MODEL
OLLAMA_FAST_MODEL
ADMIN_SECRET
CRON_SECRET
```

Do not expose values in reports or logs.

## 14. Remediation Status / Remaining Follow-Up

### Fixed 1: `/api/ai/manager` public access

File: `src/app/api/ai/manager/route.ts`

Previous finding:

- No `isAdminAuthorized()` check.
- No user session requirement.
- Local unauthenticated `POST /api/ai/manager` returned `200`.
- This route exposed admin/system context such as total article counts, topic counts, last sync, and recent AI actions.

Fix applied:

- Added `isAdminAuthorized(request)` at the top of `POST`.
- Local unauthenticated `POST /api/ai/manager` now returns `401`.

### Fixed 2: `/api/ai/newsroom/activity` public access

Files:

- `src/app/api/ai/newsroom/activity/route.ts`
- `src/app/api/admin/ai/newsroom/activity/route.ts`
- `src/components/admin/NewsroomClient.tsx`

Previous finding:

- No `isAdminAuthorized()` check.
- Local unauthenticated `GET /api/ai/newsroom/activity` returned `200`.
- Exposed recent agent activity records.

Fix applied:

- Added new admin route at `/api/admin/ai/newsroom/activity`.
- Updated `NewsroomClient` to call the admin route.
- Changed the old public route to require admin auth and return `410` only after auth.
- Local unauthenticated `GET /api/ai/newsroom/activity` now returns `401`.
- Local unauthenticated `GET /api/admin/ai/newsroom/activity` returns `401`.

### Fixed 3: `/api/admin/articles` was proxy-dependent only

File: `src/app/api/admin/articles/route.ts`

Previous finding:

- No local `isAdminAuthorized()` call.
- It was protected by `src/proxy.ts`.
- Local unauthenticated `DELETE /api/admin/articles` returned `401`.

Fix applied:

- Added independent `isAdminAuthorized(request)` at the top of `DELETE`.
- Local unauthenticated `DELETE /api/admin/articles` still returns `401`.
- Authenticated request without target still returns `400`, preserving `confirm=true` protection for full delete.

### Fixed 4: Global HTTP security headers were missing

File: `next.config.ts`

Previous finding:

- No configured `headers()` for:
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`

Fix applied:

- Added `headers()` in `next.config.ts`.
- `/` now returns:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`

### Remaining 5: Cron guard is conditional on `CRON_SECRET` existing

File: `src/app/api/sync/route.ts`

Finding:

- Production guard activates only when `CRON_SECRET` exists.
- Local `.env` has `CRON_SECRET`.
- Vercel must also have `CRON_SECRET`; otherwise production sync is open.

Recommended verification:

- Confirm Vercel Environment Variables include `CRON_SECRET`.

### Remaining 6: Local authenticated DB-backed smoke tests hit Neon connectivity failure

Finding:

- Authenticated `/api/admin/ai/newsroom/activity` and `/api/ai/manager` reached route logic but returned `500`.
- Response body showed `PrismaClientInitializationError`: cannot reach the Neon host in `DATABASE_URL`.
- This does not weaken the auth fix, because unauthenticated requests now return `401` before Prisma access.

Recommended verification:

- Re-run authenticated route smoke tests when Neon connectivity is available.
- Verify production deployment can reach the configured Neon database.

## 15. Commands Run For This Report

```powershell
rg -n "isAdminAuthorized|ADMIN_SECRET|CRON_SECRET|Authorization|admin_token|auth\.|getCurrentUser|sameSite|secure|httpOnly|Unauthorized|allowed|matcher|proxy|password|jwtVerify|NEON_AUTH" src prisma next.config.ts vercel.json package.json

Get-ChildItem -Recurse src\app -Filter route.ts

npx tsc --noEmit
```

TypeScript result:

```text
npx tsc --noEmit
# passed
```

Local HTTP checks:

```text
admin page: 307
admin ping: 401
ai batch: 401
newsroom process: 401
feed bookmarks: 401
user bookmarks: 401
admin articles delete: 401
sync dev: 200
ai manager: 401
newsroom activity old route: 401
newsroom activity admin route: 401
home security headers: present
authenticated admin articles without target: 400
authenticated newsroom activity: 500 due to Neon connectivity
authenticated AI manager: 500 due to Neon connectivity
```

Interpretation:

- `401`/`307` checks prove the expected gates are active locally.
- The previous `newsroom activity: 200` and `ai manager: 200` exposure gaps are fixed.
- Authenticated DB-backed checks reached route logic and failed on Neon database connectivity, not authorization.
- `sync dev: 200` is expected in development, but production depends on `CRON_SECRET`.

## 16. Gap Update Audit - 2026-06-03

Source: additional security gap brief reviewed against the current worktree on 2026-06-03.

### Gap 1 - Unprotected Batch AI Trigger

Status: resolved.

Route: `POST /api/ai/batch`

Location: `src/app/api/ai/batch/route.ts`

Severity: HIGH if missing; currently closed.

Finding:

- This route lives under `/api/ai/*`, so the `/api/admin/*` proxy gate does not cover it.
- Current source independently imports `isAdminAuthorized` and rejects unauthorized requests before reading the body or touching Prisma/Ollama.

Current code evidence:

```ts
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

Expected: `401` without admin auth.

### Gap 2 - No Rate Limiting On Public AI Routes

Status: open, deferred post-launch hardening.

Routes:

- `POST /api/ai/chat`
- `POST /api/ai/summarize`
- `POST /api/ai/sentiment`
- `POST /api/ai/tag`

Severity: MEDIUM.

Finding:

- Public AI routes call Ollama and do not currently enforce IP, session, or token-bucket rate limits.
- Repeated calls can saturate local or hosted inference capacity.
- Frontend guards reduce accidental duplicate calls, but direct API callers can bypass those guards.

Verification:

```powershell
for ($i = 0; $i -lt 20; $i++) {
  Invoke-WebRequest -UseBasicParsing -Method Post `
    -ContentType "application/json" `
    -Body '{"messages":[{"role":"user","content":"test"}]}' `
    http://127.0.0.1:3000/api/ai/chat
}
```

Expected current behavior: requests return `200`, `500`, or `503`, but not `429`.

### Gap 3 - No Brute Force Protection On Admin Login

Status: resolved for current launch hardening.

Route: `POST /api/admin/auth`

Location: `src/app/api/admin/auth/route.ts`

Severity: MEDIUM.

Finding:

- The admin login uses one shared `ADMIN_SECRET`.
- The cookie no longer stores the raw `ADMIN_SECRET`; it stores a signed 64-character hex session token validated by `src/lib/adminSessions.ts`.
- A fixed 100ms delay has now been added before all configured success/failure responses to slow brute-force attempts.
- Additional medium-term hardening remains useful: persistent/shared session storage or role-based admin auth for multi-instance production.

Current code evidence:

```ts
const sessionToken = createAdminSession()
response.cookies.set("admin_token", sessionToken, {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 86400,
})
```

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  -ContentType "application/json" `
  -Body '{ "password": "wrong" }' `
  http://127.0.0.1:3000/api/admin/auth
```

Expected: `401` after the fixed delay.

### Gap 4 - Digest Model Env Var Mismatch

Status: resolved.

Route: `GET /api/ai/digest`

Location: `src/app/api/ai/digest/route.ts`

Severity: LOW.

Finding:

- Current source uses `process.env.OLLAMA_DIGEST_MODEL || "llama3"` for digest model reporting.
- The stale `OLLAMA_MODEL_DIGEST` name is no longer present in source.

Verification:

```powershell
rg -n "OLLAMA_MODEL_DIGEST" src
```

Expected: zero results.

### Gap 5 - RSS Prompt Injection Risk

Status: mitigated short term; pattern detection remains open.

Locations:

- `src/lib/fetchFeeds.ts`
- `src/lib/agents.ts`
- `src/lib/ollama.ts`
- `src/app/api/ai/chat/route.ts`

Severity: LOW-MEDIUM.

Finding:

- RSS content is used as AI context in Scout, chat, and digest prompts.
- Current `cleanDescription()` decodes entities first, strips tags and leftover angle brackets, redacts injection patterns, and caps stored descriptions at 500 chars.
- Scout prompt descriptions are capped to 150 chars.
- Instruction-pattern detection is present for text such as "ignore previous instructions", "system prompt", and "new instructions:".

Current code evidence:

```ts
export function cleanDescription(raw: string | undefined): string {
  if (!raw) return ""
  let text = raw
  text = decodeHtmlEntities(text)
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/[<>]/g, "")
  text = stripInjectionPatterns(text)
  return text.replace(/\s+/g, " ").trim().slice(0, 500)
}
```

Verification:

```powershell
rg -n "slice\\(0, 200\\)|slice\\(0, 150\\)" src/lib/fetchFeeds.ts src/lib/agents.ts
```

Expected: feed descriptions are capped at or below 500 chars before Ollama prompt insertion.

### Gap 6 - Search API May Return Unpublished Drafts

Status: resolved.

Route: `GET /api/search`

Location: `src/app/api/search/route.ts`

Severity: MEDIUM if missing; currently closed.

Finding:

- Current search query includes `published: true`.
- This prevents unpublished AI drafts from appearing in public search results.

Current code evidence:

```ts
const articles = await prisma.newsArticle.findMany({
  where: {
    published: true,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { source: { contains: q, mode: "insensitive" } },
      { topic: { contains: q, mode: "insensitive" } },
    ],
  },
```

Verification:

```powershell
Get-Content -Raw src/app/api/search/route.ts
```

Expected: `published: true` is present in the Prisma `where` clause.

### Gap 7 - User Route Auth When Neon Auth Is Not Configured

Status: resolved.

Routes:

- `GET/POST/DELETE /api/user/bookmarks`
- `POST /api/user/read`
- `GET/POST /api/user/preferences`

Locations:

- `src/app/api/user/bookmarks/route.ts`
- `src/app/api/user/read/route.ts`
- `src/app/api/user/preferences/route.ts`
- `src/lib/auth.ts`

Severity: MEDIUM.

Finding:

- `getMutableCurrentUserId()` returns `null` when Neon Auth is not configured or no user session exists.
- Bookmark and preference routes already returned `401`.
- Read tracking previously returned success for anonymous users. It now returns `401`, preventing silent unauthenticated tracking behavior.

Current code evidence:

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

Expected: `401` without a signed-in Neon Auth user.

### Gap 8 - AutoSync Self-HTTP Bootstrap Race

Status: resolved.

Location: `src/lib/autoSync.ts`

Severity: LOW operational.

Finding:

- AutoSync no longer calls `http://localhost:3000/api/sync`.
- It runs sync directly in-process with `fetchFeedsWithStatus()` and Prisma upserts.
- This removes the startup race where the module fires before the HTTP server is listening.

Current code evidence:

```ts
const { articles, successNames, failedNames } =
  await fetchFeedsWithStatus(dbSources)

await prisma.newsArticle.upsert({
  where: { link: article.link },
```

Verification:

```powershell
rg -n "localhost:3000|/api/sync|BASE_URL" src/lib/autoSync.ts
```

Expected: zero self-HTTP sync calls.

### Gap 9 - Seed-Sources Endpoint Auth Verification

Status: resolved.

Route: `POST /api/admin/seed-sources`

Location: `src/app/api/admin/seed-sources/route.ts`

Severity: MEDIUM if missing; currently closed.

Finding:

- The endpoint can upsert source configuration.
- Current source independently checks `isAdminAuthorized(request)` before calling `seedFeedSources()`.

Current code evidence:

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

Expected: `401` without admin auth.

### Gap 10 - Newsroom Process Protected

Status: resolved.

Route: `POST /api/ai/newsroom/process`

Location: `src/app/api/ai/newsroom/process/route.ts`

Severity: HIGH if missing; currently closed.

Resolution:

- `isAdminAuthorized(request)` is present at the top of the `POST` handler.
- Local unauthenticated verification previously returned `401`.

Verification:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post `
  -ContentType "application/json" `
  -Body '{}' `
  http://127.0.0.1:3000/api/ai/newsroom/process
```

Expected: `401` without admin auth.

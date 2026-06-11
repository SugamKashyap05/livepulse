# Sprint 2 Plan: Source Manager + Scheduler

Scope owner: Source Manager Room/submodule and Scheduler/Cron Control Panel for the LivePulse AI Manager.

Non-goals for this lane:
- Do not edit `prisma/schema.prisma` in this pass.
- Do not edit `src/lib/adminAiJobs.ts` or `src/components/admin/AiManagerClient.tsx`.
- Do not implement the appendix lanes here.

## Existing Capabilities

### Source Manager

Existing files:
- `src/app/admin/sources/page.tsx`
- `src/components/admin/SourcesClient.tsx`
- `src/app/api/admin/sources/route.ts`
- `src/app/api/admin/ping/route.ts`
- `src/lib/fetchFeeds.ts`
- `src/lib/autoSync.ts`
- `src/app/api/admin/sync/route.ts`
- `prisma/schema.prisma` model `FeedSource`

What already works:
- RSS source list page at `/admin/sources`.
- Server-side source load from `prisma.feedSource`, falling back to `FEED_SOURCES` when empty.
- Article counts grouped by `newsArticle.source`.
- Create source via `POST /api/admin/sources`.
- Edit core fields through `PATCH /api/admin/sources` if supplied by a caller.
- Pause/resume through `PATCH /api/admin/sources` with `enabled`.
- Delete a source through `DELETE /api/admin/sources` when it has no articles.
- Per-source and bulk ping in `SourcesClient` via `GET /api/admin/ping?url=...`.
- Stored health fields exist on `FeedSource`: `lastFetched`, `lastStatus`, `failCount`.
- RSS sync updates source health after fetch: success resets `failCount`; failure increments it.

Gaps:
- No dedicated `GET /api/admin/sources/health` endpoint for consolidated health badges, recent errors, stale feeds, or aggregate counts.
- `fetchFeedsWithStatus` only returns source names, not durations, HTTP status, parser error reasons, item counts, or last error text.
- Source removal is hard delete only when `articleCount === 0`; there is no archive/soft-remove concept without a schema addition.
- UI has no inline edit flow despite API support for editable fields.
- UI health is simple text, not normalized badges such as Healthy, Degraded, Failing, Paused, Stale.

### Scheduler

Existing files:
- `src/lib/autoSync.ts`
- `src/instrumentation.ts`
- `src/app/api/admin/sync/route.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/admin/ai/jobs/route.ts`
- `src/app/api/admin/ai/jobs/run-next/route.ts`
- `src/components/admin/AdminSync.tsx`
- `src/components/admin/rooms/OperationsRoomModule.tsx`
- `src/components/admin/rooms/AssignmentDeskModule.tsx`

What already works:
- Development-only `startAutoSync()` is registered from `src/instrumentation.ts`.
- Auto sync uses a fixed 5 minute interval and skips overlapping runs with an in-memory lock.
- Manual admin RSS sync exists at `POST /api/admin/sync`.
- Public/cron-style sync exists at `GET /api/sync`.
- AI jobs support `scheduledFor` on `AdminAiJob`.
- `runNextAdminAiJob()` is exposed by `POST /api/admin/ai/jobs/run-next`.
- Assignment/operations room UI already displays scheduled AI jobs.

Gaps:
- No visible scheduler control panel for feed sync or job runner schedules.
- No persisted scheduler configuration for enable/disable, interval/cron expression, next run override, or last run metadata.
- Existing RSS auto-sync state is process-local and development-only.
- Existing manual sync response is useful, but not recorded as scheduler history.
- No scheduler endpoints under `/api/admin/scheduler`.

## Data Model Proposal

Keep this as a Sprint 2 migration proposal for the Prisma/core owner.

### Option A: Minimal Scheduler Table

`AdminSchedule`
- `id String @id @default(cuid())`
- `key String @unique` such as `rss.sync`, `ai.jobs.run-next`, `rag.reindex.missing`
- `label String`
- `enabled Boolean @default(true)`
- `intervalMs Int?`
- `cron String?`
- `lastRunAt DateTime?`
- `lastRunStatus String?`
- `lastRunSummary Json?`
- `nextRunAt DateTime?`
- `overrideNextRunAt DateTime?`
- `lockedAt DateTime?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

### Option B: No New Table for First UI Slice

Derive read-only scheduler rows from code constants and current tables:
- RSS sync: fixed interval from `autoSync.ts`, last run from `max(feedSource.lastFetched)`, status from `FeedSource` aggregates.
- AI job runner: scheduled jobs from `AdminAiJob.scheduledFor`, queue stats from `AdminAiJob.status`.
- RAG reindex: current status from `/api/admin/rag/status`.

This enables a visible panel quickly, but enable/disable and override next run remain process-local or unavailable until Option A lands.

Recommended path: ship Option B UI contracts first, then add Option A with the Prisma/core owner.

## API Contracts To Add

### `GET /api/admin/sources/health`

Purpose: source-room health dashboard and badge data.

Response shape:
```json
{
  "summary": {
    "total": 42,
    "enabled": 39,
    "paused": 3,
    "healthy": 34,
    "degraded": 4,
    "failing": 1,
    "stale": 2
  },
  "sources": [
    {
      "id": "cuid",
      "name": "BBC",
      "url": "https://...",
      "topic": "world",
      "region": "global",
      "enabled": true,
      "lastFetched": "2026-06-11T10:00:00.000Z",
      "lastStatus": "ok",
      "failCount": 0,
      "articleCount": 120,
      "badge": "healthy",
      "stale": false
    }
  ]
}
```

Initial badge rules:
- `paused`: `enabled === false`
- `failing`: `lastStatus === "error"` and `failCount >= 3`
- `degraded`: `lastStatus === "error"` or `failCount > 0`
- `stale`: enabled source with no successful fetch in 24 hours
- `healthy`: enabled, recent, and `lastStatus === "ok"`

### `POST /api/admin/sources/health`

Purpose: run a health check for one source or all sources without saving articles.

Request:
```json
{ "sourceId": "optional-cuid" }
```

Response:
```json
{
  "checked": 5,
  "ok": 4,
  "failed": 1,
  "results": [
    {
      "sourceId": "cuid",
      "name": "BBC",
      "ok": true,
      "status": 200,
      "durationMs": 344,
      "message": null
    }
  ]
}
```

Implementation note: reuse the allowed-host safety posture from `src/app/api/admin/ping/route.ts`. Prefer adding a small helper in `src/lib/fetchFeeds.ts` that returns health metadata rather than duplicating parser/fetch logic in route handlers.

### `GET /api/admin/scheduler`

Purpose: visible control panel rows.

Response shape:
```json
{
  "schedules": [
    {
      "key": "rss.sync",
      "label": "RSS Sync",
      "enabled": true,
      "cadenceLabel": "Every 5 minutes",
      "lastRunAt": "2026-06-11T10:00:00.000Z",
      "lastRunStatus": "ok",
      "nextRunAt": "2026-06-11T10:05:00.000Z",
      "overrideNextRunAt": null,
      "summary": {
        "okSources": 39,
        "failedSources": 1
      }
    }
  ]
}
```

Initial rows:
- `rss.sync`
- `ai.jobs.run-next`
- `rag.reindex.missing` if RAG owner agrees to expose a lightweight run action

### `PATCH /api/admin/scheduler/:key`

Purpose: enable/disable and override next run.

Request:
```json
{
  "enabled": false,
  "overrideNextRunAt": "2026-06-11T11:30:00.000Z"
}
```

Until `AdminSchedule` exists, return `501 Not Implemented` for persistent mutations or accept only process-local overrides in development.

### `POST /api/admin/scheduler/:key/run`

Purpose: run now.

Initial mappings:
- `rss.sync` calls the same sync workflow as `POST /api/admin/sync`.
- `ai.jobs.run-next` calls the same workflow as `POST /api/admin/ai/jobs/run-next`.

Implementation note: extract shared sync logic from `src/app/api/admin/sync/route.ts` before adding this endpoint, so manual sync, cron sync, and scheduler run-now do not drift.

## UI Plan

### Source Manager Room/Submodule

Recommended target:
- Keep `/admin/sources` as the dedicated page.
- Add a compact Source Manager module inside the AI Manager only after route contracts are stable.
- Reuse the same data shape from `GET /api/admin/sources/health`.

Controls:
- Add source form, already present.
- Pause/resume button, already present.
- Delete/remove button, already present for unused sources.
- Add inline edit for name, URL, topic, region, priority.
- Add health badges with summary chips.
- Add "Check health" action per row and "Check all" action.
- Add error count and stale indicator in the status column.

### Scheduler/Cron Control Panel

Recommended target:
- New admin submodule/page: `/admin/scheduler`.
- Later embed a compact card in Operations Room because it already owns queue/scheduler signals.

Controls:
- Schedule rows with key, cadence, enabled state, last run, next run, last result.
- Toggle enabled.
- Run now.
- Override next run with date/time input.
- Clear override.
- Show mutation disabled states when persistence is unavailable.

## Sprint 2 Task Breakdown

1. Extract RSS sync core into a reusable `runRssSync({ mode, sourceIds? })` helper.
2. Add source health helper that returns `ok`, duration, item count where available, and a safe message.
3. Add `GET /api/admin/sources/health`.
4. Add `POST /api/admin/sources/health`.
5. Upgrade `/admin/sources` UI to consume health endpoint and render badges.
6. Add inline source edit UI using existing `PATCH /api/admin/sources`.
7. Add scheduler read model constants for initial schedules.
8. Add `GET /api/admin/scheduler`.
9. Add scheduler run-now endpoints or a single keyed route.
10. Coordinate `AdminSchedule` migration with Prisma/core owner.
11. Add persistent enable/disable and override next run once `AdminSchedule` lands.
12. Add focused tests for source validation, health badge derivation, and scheduler read model.

## Implementation Backlog

Priority guidance:
- Sprint 2 first: Source Manager health/read model, then Scheduler read-only panel and run-now paths.
- Sprint 2 support: Notification Rules only if source/scheduler health needs alert thresholds.
- Wait: config-heavy or schema-heavy modules until the Prisma/core owner finalizes shared models.

| Priority | Module | Current status | Why this status | Exact next assignment |
| --- | --- | --- | --- | --- |
| P0 | Source Manager | Partially implemented | `/admin/sources`, `SourcesClient`, CRUD APIs, ping, pause/resume, delete-unused, and stored health counters exist; health API, badge model, inline edit UI, and richer errors are missing. | Source worker: add `GET/POST /api/admin/sources/health`, extract reusable feed health helper, add source health badges and inline edit to `/admin/sources`. |
| P0 | Scheduler | Partially implemented | Manual RSS sync, dev interval auto-sync, scheduled AI jobs, and run-next job endpoint exist; no `/api/admin/scheduler`, no control panel, and no persistent schedule config. | Scheduler worker: ship read-only `/api/admin/scheduler`, derive initial rows from current tables/constants, add run-now route wrapper after extracting shared RSS sync logic. |
| P1 | Notification Rules | Partially implemented | Admin notifications, polling provider, read/mark-all endpoints, department events, and severity fields exist; configurable rules and thresholds do not. | Notifications worker: define rule model/contract for source failures, stale feeds, failed jobs, DLQ depth, and cost thresholds; wire after Source/Scheduler health shapes settle. |
| P1 | DLQ | Planned-only | Retry/cancel, job transitions, failed job states, and Operations room recovery signals exist; there is no explicit dead-letter queue, replay inbox, or terminal failure policy. | Reliability worker: define DLQ criteria for failed RSS checks and failed AI jobs, then propose `AdminDeadLetter` or derive-from-jobs MVP before schema work. |
| P1 | Article Provenance | Planned-only | Articles store source/link/topic plus editor context refs and audit logs exist; no provenance chain captures fetch metadata, AI transformations, publish actions, or citations per article. | Provenance worker: propose article provenance event contract and read model covering ingest, AI analysis, editor action, publish/unpublish, and source health context. |
| P2 | Bulk Publishing | Partially implemented | Publishing desk supports single draft publish, discard, reanalyse, and unpublish; no multi-select, batch preview, batch rollback, or bulk publish endpoint. | Publishing worker: add multi-select UX and batch API plan after provenance/audit expectations are settled. |
| P2 | Cost/Token Tracker | Partially implemented | `AiLog` has action, model, tokens, ms, success, and error; many AI calls log tokens, but no cost estimates, budgets, rollups, or admin control surface. | Observability worker: build cost read model from `AiLog`, define per-model pricing config, then add budget threshold hooks for Notification Rules. |
| P2 | Global Search | Partially implemented | Public `/search` and `/api/search` exist for published feed search; no admin global search across articles, drafts, jobs, departments, notifications, and source health. | Search worker: design admin global search route with scoped filters and permission-safe result cards. |
| P3 | PipelineConfig | Planned-only | Department definitions, job schemas, and hardcoded workflows exist; no persisted pipeline config or admin controls for stage order/gates. | Pipeline worker: inventory current job types and department flows, then propose config schema for stage enablement, gates, retries, and dependencies. |
| P3 | AgentConfig | Planned-only | `AGENTS`, model constants, prompts, and department roles exist in code; no admin-editable agent/model/prompt settings. | Agent config worker: define read-only config registry first, then propose safe editable fields and validation boundaries. |
| P3 | Export/Archive | Planned-only | There are purge endpoints and archived statuses on department events; no export tooling or archive control surface for articles, jobs, audit logs, source health, or reports. | Export worker: define CSV/JSON export endpoints and archive retention policies after search/provenance shapes stabilize. |

## Operations, Security, And Infra Backlog

This section maps Claude's operations/security review items to current implementation status and next ownership.

| Risk area | Current status | Evidence | Gap | Assigned next worker |
| --- | --- | --- | --- | --- |
| Admin API auth coverage | Implemented with special cases | All inspected `/api/admin/*/route.ts` files use `isAdminAuthorized(request)` except `/api/admin/auth` login, `/api/admin/logout`, and `/api/admin/ai/jobs/run-next`, which accepts either admin auth or `CRON_SECRET`. | Add a lightweight automated test/script that fails CI when a new admin route lacks auth. | Security worker: add route-auth audit test for `src/app/api/admin/**/route.ts` with allowlist for auth/logout/cron. |
| `/admin/ai-manager` page protection | Gap | `/admin/ai-manager/page.tsx` and `/admin/ai-manager/[department]/page.tsx` query Prisma during server render; `src/app/admin/layout.tsx` does not check an admin session; no `src/middleware.*` exists. | Unauthenticated users may receive admin-rendered data if page routes are reachable, even though client API calls are protected. | Security worker: add admin page middleware or server-layout guard using the existing admin session cookie validation before any Prisma reads. |
| Prompt injection sanitation for manager/editor context | Partially implemented | User messages are role-filtered and length-clamped; RSS/RAG chunk creation uses `sanitizeAiText`; `textSafety.ts` strips several injection phrases. | Manager chat builds a system prompt from DB events, RAG status, editor context JSON, failures, and department event bodies without a dedicated "data-only" wrapper/sanitizer for all fields. | AI safety worker: create a shared `sanitizeAdminPromptContext` helper, wrap retrieved/admin context in explicit data delimiters, and add tests for prompt-injection strings in event bodies/editor context. |
| RAG/admin output grounding | Partially implemented | Public RAG chat instructs "Use only retrieved context" and "Cite factual claims"; `extractCitedSources` records citations. | Admin manager replies are not required to cite/ground claims; `/api/admin/rag/query` returns raw chunk content/context without a response policy; citations are not validated against retrieved source names. | AI safety worker: require source citations for admin/RAG factual claims, return allowed citation sources with each RAG/admin response, and flag unsupported claims in UI metadata. |
| `/api/admin/rag/query` validation | Partially implemented | Route requires admin auth, trims `query`, slices it to 500 chars, clamps `limit` to 1-20, and uses parameterized Prisma queries through `searchRagContext`. | It silently truncates overlong input, does not reject ASCII control characters, does not validate `topic` against known topics, and does not cap `articleId` format beyond trimming. | RAG worker: add explicit 400 responses for overlong/control-char queries, validate topic against `ALL_TOPICS`, validate `articleId` shape/existence when supplied, and log rejected requests without storing raw unsafe text. |
| Consolidated admin event stream | Missing | No `/api/admin/events/stream` route exists; admin notifications, manager jobs/messages, newsroom activity, and room events use polling intervals. | Polling duplicates load and delays UX updates. | Realtime worker: add authenticated `GET /api/admin/events/stream` SSE that emits notifications, job transitions, department events, editor inbox changes, and source/RAG health deltas; migrate polling clients gradually. |
| RAG stale health alert | Gap | `getRagStatus()` returns coverage, `lastIndexed`, model, and latest error; Research and Operations rooms display coverage/status. | No thresholded stale alert exists for low coverage, old `lastIndexed`, embedding model mismatch, or latest RAG error. | Operations worker: add RAG health badge/rule set, create admin notification/department event when coverage is below threshold or `lastIndexed` is stale, and surface it in Scheduler/Operations. |
| Neon pool warm-up | Gap | `src/lib/db.ts` instantiates a shared PrismaClient and logs errors only; no `$connect()` warm-up or readiness endpoint exists. | First admin render/job can pay cold connection cost; failures surface late under load. | Infra worker: add safe startup/readiness warm-up (`prisma.$connect()` plus a cheap query) for admin/job paths, document Neon pooling expectations, and expose status in Operations room. |
| Ollama parallelization | Partially implemented | Embeddings have a small in-memory cache; many AI/RAG loops process sequentially to stay simple and avoid overload. | No concurrency limiter, model warm-up queue, or parallel batch strategy exists; sequential RAG indexing and AI batches can be slow, while unbounded parallelism would overload Ollama. | Infra/AI runtime worker: add bounded concurrency per model/action, preflight model warm-up, backpressure metrics, and retry policy; keep defaults conservative for local Ollama. |
| Operations room indexes/cache risks | Partially implemented | Prisma schema includes useful indexes for `AdminAiJob`, `AdminDepartmentEvent`, `AdminNotification`, `NewsArticle`, and `ArticleEmbedding`; admin pages are `force-dynamic`. | Operations/AI Manager pages run many live counts and raw aggregate queries per render with no short TTL cache/read model; event polling amplifies DB load. | Ops performance worker: profile `/admin/ai-manager` and department pages, add short-lived server-side read-model cache for counts/health, and propose additional composite indexes only after query evidence. |
| AI response citation/grounding requirement | Partially implemented | Public chat RAG has citation instructions and context stats; article/RAG chunks preserve source names. | Manager/admin actions, summaries, digest, and RAG query tester do not enforce citations or mark unsupported output. | AI safety worker: define a cross-AI response contract with `groundingSources`, `unsupportedClaims`, and citation requirements for admin-facing factual responses. |

## Appendix: Future Planning Lane Map

These are planning-only ownership notes for future workers.

| Lane | Suggested owner | First task | Key files to inspect |
| --- | --- | --- | --- |
| PipelineConfig | Pipeline/core worker | Define configurable stages for RSS ingest, AI processing, RAG indexing, and publishing gates. | `src/lib/autoSync.ts`, `src/lib/adminAiJobs.ts`, `src/lib/rag.ts` |
| AgentConfig | AI Manager worker | Centralize agent model, prompt, retry, and temperature settings. | `src/lib/agents.ts`, `src/lib/ollama.ts`, `src/lib/adminDepartments.ts` |
| ArticleProvenance | Content integrity worker | Track article origin, source fetch metadata, transformations, and AI edits. | `prisma/schema.prisma`, `src/lib/fetchFeeds.ts`, `src/app/api/admin/ai/publish/route.ts` |
| Dead Letter Queue | Reliability worker | Capture failed sync items and failed AI jobs with retry/replay controls. | `src/lib/adminAiJobs.ts`, `src/lib/jobTransitions.ts`, `src/app/api/admin/ai/jobs/*` |
| Cost/Token Tracker | AI observability worker | Record token usage, model, latency, and estimated cost for each AI action. | `src/lib/ollama.ts`, `src/lib/adminAudit.ts`, `prisma/schema.prisma` |
| Notification Rules | Admin UX worker | Add configurable thresholds and routing for admin notifications. | `src/app/api/admin/notifications/route.ts`, `src/components/admin/AdminNotificationProvider.tsx` |
| Bulk Publishing | Publishing desk worker | Add selection, preview, publish/unpublish, and rollback for batches. | `src/components/admin/rooms/PublishingDeskModule.tsx`, `src/app/api/admin/ai/publish/route.ts` |
| Global Article Search | Search worker | Unify published articles, AI drafts, tags, source filters, and date ranges. | `src/app/search/page.tsx`, `src/app/api/search/route.ts`, `src/lib/paginatedFeed.ts` |
| Export tooling | Ops/reporting worker | Export articles, job history, audit logs, and source health as CSV/JSON. | `src/components/admin/rooms/ReportingRoomModule.tsx`, `src/lib/adminAudit.ts`, admin API routes |

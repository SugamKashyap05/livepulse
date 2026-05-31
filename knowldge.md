# LivePulse Project Knowledge

Last updated: 2026-05-31

This file is the working project memory for LivePulse. Update it after every code edit so future work can start here before re-reading the full repository.

## Agent Rule

- This project uses Next.js `16.2.3`, which has breaking changes from older Next versions.
- Before changing Next routing, rendering, data fetching, metadata, instrumentation, server actions, middleware, or config behavior, read the relevant local docs under `node_modules/next/dist/docs/`.
- The docs index includes an agent hint: slow client-side navigation fixes may need `unstable_instant`, not only `Suspense`; read `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx` if touching that area.

## Project Summary

LivePulse is a Next.js App Router news aggregator with:

- RSS ingestion from configured global news feeds.
- Prisma + SQLite persistence.
- Public news browsing by topic.
- A daily AI digest.
- Article-level AI summarization, sentiment, and tags through local Ollama.
- Admin tools for sync, article deletion, source health, AI batch processing, and an agentic newsroom.
- Vercel cron configured to call `/api/sync` every 5 minutes.

## Stack

- Framework: Next.js `16.2.3`, App Router.
- React: `19.2.4`.
- TypeScript: strict mode enabled.
- Styling: Tailwind CSS `4` is installed, but most UI currently uses inline styles plus CSS variables from `src/app/globals.css`.
- Database: Prisma `5.22.0` with SQLite at `prisma/livepulse.db`.
- RSS: `rss-parser`.
- Dates: `date-fns`.
- AI backend: local Ollama HTTP API, default host `http://localhost:11434`.

## Commands

- `npm run dev`: start Next dev server.
- `npm run build`: production build.
- `npm run start`: start built Next app.
- `npm run lint`: ESLint.

## Environment Variables

Known variable names in `.env`:

- `DATABASE_URL`
- `NEXT_PUBLIC_BASE_URL`
- `OLLAMA_MODEL`
- `OLLAMA_DIGEST_MODEL`
- `OLLAMA_SUMMARY_MODEL`
- `OLLAMA_CHAT_MODEL`
- `OLLAMA_FAST_MODEL`
- `ADMIN_SECRET`

Code also references:

- `OLLAMA_HOST`
- `OLLAMA_MODEL_CHAT`
- `OLLAMA_MODEL_MANAGER`
- `CRON_SECRET`

Do not write secret values into this file.

## Important Config

- `next.config.ts`: enables `reactCompiler: true`; `experimental` is currently empty.
- `tsconfig.json`: path alias `@/*` maps to `./src/*`; includes `.next/types` and `.next/dev/types`.
- `eslint.config.mjs`: uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- `vercel.json`: cron schedule hits `/api/sync` every 5 minutes.
- `src/proxy.ts`: Next 16 Proxy auth gate for `/admin/:path*` and `/api/admin/:path*`.
- `src/instrumentation.ts`: when `NEXT_RUNTIME === "nodejs"` and `NODE_ENV === "development"`, dynamically imports `startAutoSync()` and starts a local server-side sync loop. Production relies on Vercel cron.

## Data Model

Prisma schema: `prisma/schema.prisma`.

Models:

- `NewsArticle`
  - Core fields: `id`, `title`, `description`, `link`, `pubDate`, `source`, `topic`, `slug`, `image`, `fetchedAt`.
  - AI fields: `summary`, `sentiment`, `aiTags`, `aiProcessed`, `aiGenerated`.
  - Agentic fields: `factScore`, `biasAnalysis`, `agentNotes`, `published`, `scored`.
  - Indexes: `topic`, `slug`, `fetchedAt`; `link` is unique.
- `AgentActivity`
  - Logs agent work for Scout, Fact-Checker, Spin-Doctor, etc.
- `DailyDigest`
  - One digest per date string such as `2026-03-27`.
- `AiLog`
  - Logs AI actions, model, prompt snippet, token count, timing, success/error.

## RSS Sources And Topics

Configured in `src/lib/sources.ts`.

Topics:

- `all`
- `world`
- `technology`
- `india`
- `business`
- `science`
- `sports`

Feed count: 13.

Sources:

- BBC World, Al Jazeera
- The Verge, TechCrunch, Hacker News
- NDTV, Times of India
- CNBC Business, BBC Business
- Science Daily, NASA
- BBC Sport, ESPN

## Core Libraries

- `src/lib/db.ts`
  - Exports singleton Prisma client.
  - Stores Prisma on `globalThis` outside production to avoid dev hot-reload client churn.
- `src/lib/fetchFeeds.ts`
  - Builds RSS parser with browser-like headers.
  - Fetches each source, falls back from `parseURL` to manual `fetch` + `parseString`.
  - Extracts media image from RSS media/enclosure/content.
  - Cleans descriptions by stripping HTML and basic entities.
  - Returns max 15 items per source.
  - Dedupes by generated MD5 id.
- `src/lib/autoSync.ts`
  - Calls `${NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/sync`.
  - Starts first sync after 3 seconds, then every 5 minutes.
  - Uses an `isSyncing` guard.
- `src/lib/ollama.ts`
  - `MODELS`: `SUMMARY`, `DIGEST`, `CHAT`, `MANAGER`, `FAST`.
  - `ollamaChat()` calls `/api/chat`.
  - `chat()` calls `/api/generate`.
  - `structuredChat<T>()` calls `/api/generate` with `format: "json"` and parses JSON.
  - `generateDigest()` creates a grouped news briefing.
  - `managerChat()` answers admin questions using DB context.
  - `logAiAction()` writes `AiLog`.
- `src/lib/agents.ts`
  - Defines Scout, Fact-Checker, Spin-Doctor, Editorial-AI agents.
  - `runFactChecker(articleId)`: writes `factScore` and `agentNotes`.
  - `runSpinDoctor(articleId)`: writes `biasAnalysis`.
  - `runScoutGeneration()`: generates unpublished AI draft articles for selected topics using recent DB context and an existing image.
  - `runFullAgenticCycle()`: runs Scout generation, then fact/bias processing for up to 10 unprocessed articles.

## Public App Routes

- `/`
  - File: `src/app/page.tsx`.
  - Dynamic page; reads latest 200 `NewsArticle` rows from Prisma.
  - If DB is empty or read fails, fetches live RSS directly.
  - Renders `Header`, topic tabs, article grid, and `NewsCard`.
- `/topic/[slug]`
  - File: `src/app/topic/[slug]/page.tsx`.
  - Dynamic page.
  - Uses Next 16-style `params: Promise<{ slug: string }>` and awaits it.
  - Reads up to 100 articles matching `slug`.
- `/digest`
  - File: `src/app/digest/page.tsx`.
  - Shows existing `DailyDigest` for today's date plus top 5 headlines.
  - `DigestClient` can generate or regenerate via `/api/ai/digest`.
- `/ai-news`
  - File: `src/app/ai-news/page.tsx`.
  - Shows `aiGenerated: true` and `published: true` articles.

## Root Layout And Styling

- `src/app/layout.tsx`
  - Imports global CSS.
  - Adds Google Fonts in `<head>`.
  - Renders `ChatAssistant` globally after every page's children.
- `src/app/globals.css`
  - Defines dark theme variables: `--bg`, `--surface`, `--surface2`, `--border`, `--border2`, `--text`, `--muted`, `--accent`, `--accent2`, `--red`.
  - Includes Tailwind directives.

## Main Components

- `Header`
  - Sticky header with LivePulse branding, links to `/digest` and `/ai-news`, live badge, UTC date.
- `NewsCard`
  - Client component for article display.
  - Shows image or source placeholder.
  - Can call `/api/ai/summarize` and `/api/ai/sentiment`.
  - Parses `aiTags` JSON string.
  - Has topic colors and sentiment labels.
- `DigestClient`
  - Client component for generating/regenerating daily digest.
- `ChatWidget`
  - Legacy client floating chat UI. It still exists, but the home page no longer renders it.
  - Calls `/api/ai/chat` and expects JSON `{ reply, model }`.
- `ChatAssistant`
  - Global floating chat UI from layout.
  - Consumes JSON `{ reply, model }` from `/api/ai/chat`.
- `TopicTabs`, `SearchBar`, `NewsGrid`
  - Present but appear minimal/simple compared with the current inline page implementation.

## Admin Routes

All admin pages use `src/app/admin/layout.tsx`, which renders `AdminSidebar` and a scrollable main area.

- Admin auth:
  - Implemented in `src/proxy.ts` using Next 16 Proxy, not deprecated Middleware.
  - `src/proxy.ts` uses `export default function proxy(request: NextRequest)` plus `export const config`.
  - Shared auth predicate lives in `src/lib/adminAuth.ts`.
  - Protects `/admin/:path*` and `/api/admin/:path*`.
  - Allows `/admin/login` and `/api/admin/auth`.
  - Accepts `Authorization: Bearer <ADMIN_SECRET>` or `admin_token=<ADMIN_SECRET>` cookie.
  - Unauthorized admin pages redirect to `/admin/login?next=<path>`.
  - Unauthorized admin APIs return `401 { "error": "Unauthorized" }`.
- `/admin/login`
  - Client login form that posts `{ password }` to `/api/admin/auth`.
  - Successful auth sets an httpOnly `admin_token` cookie and redirects to requested admin page or `/admin`.
- `/admin`
  - Dashboard with total articles, added today, active sources, topics covered, sync control, AI batch processor, and topic/source counts.
- `/admin/articles`
  - Lists up to 500 articles and passes serialized dates to `ArticlesClient`.
- `/admin/sources`
  - Combines configured feeds with DB counts and latest fetched time.
- `/admin/health`
  - Source health page using `HealthClient`.
- `/admin/settings`
  - Shows total articles and oldest date; settings client can use purge/admin APIs.
- `/admin/ai-manager`
  - Shows AI coverage counts, recent logs, recent digests, and model names.
- `/admin/newsroom`
  - Shows recent `AgentActivity` and controls agentic newsroom processing.

## API Routes

- `GET /api/sync`
  - Fetches all RSS feeds and upserts articles by unique `link`.
  - In production, if `CRON_SECRET` exists, requires `Authorization: Bearer <CRON_SECRET>`.
  - Deletes articles where `fetchedAt` is older than 3 days.
  - Returns `{ success, saved, skipped, total }`.
- `DELETE /api/admin/articles`
  - Query params: `id`, `topic`.
  - Deletes one article or all in a topic.
  - Full database delete requires `confirm=true`; without `id`, `topic`, or `confirm=true`, it returns 400.
- `POST /api/admin/auth`
  - Body: `password`.
  - Verifies against `ADMIN_SECRET`.
  - Sets httpOnly `admin_token` cookie with `path=/`, `sameSite=strict`, `secure` only in production, and `maxAge=86400`.
- `DELETE /api/admin/purge`
  - Query param: `days`, default `3`.
  - Deletes articles with `pubDate` older than cutoff.
- `GET /api/admin/ping`
  - Query param: `url`.
  - HEAD checks a feed/source URL and returns status.
  - Independently checks `isAdminAuthorized(request)` before parsing the URL.
  - SSRF guard: only `http:`/`https:` URLs whose hostname matches configured `FEED_SOURCES` hostnames are allowed.
- `DELETE /api/admin/purge`
  - Query param: `days`, default `3`.
  - Independently checks `isAdminAuthorized(request)` before deleting.
- `POST /api/ai/summarize`
  - Body: `id`, `title`, `description`.
  - Caches summary on `NewsArticle.summary`.
- `POST /api/ai/tag`
  - Body: `id`, `title`, `description`, `topic`.
  - Uses structured JSON response; stores `aiTags` and sets `aiProcessed`.
- `POST /api/ai/sentiment`
  - Body: `id`, `title`, `description`.
  - Uses structured JSON response; stores lowercase `sentiment` and sets `scored`.
- `POST /api/ai/batch`
  - Body: `task`, `limit`.
  - Supports `sentiment`, `tag`, `summarize`, and `all`.
  - Processes matching unprocessed rows sequentially.
- `GET /api/ai/digest`
  - Returns today's cached digest if present, otherwise generates one from today's fetched articles or latest fallback articles.
- `DELETE /api/ai/digest`
  - Deletes today's digest so it can be regenerated.
- `POST /api/ai/chat`
  - Body: `messages`, optional `topic`.
  - Loads up to 20 recent articles as context.
  - Returns JSON `{ reply, model }`.
  - Returns `503 { error: "AI service unavailable", fallback: true }` if Ollama is unavailable.
- `POST /api/ai/manager`
  - Body: `messages`.
  - Builds admin context from article counts, topics, last sync, and recent AI logs.
- `POST /api/ai/newsroom/process`
  - Runs full agentic cycle.
- `GET /api/ai/newsroom/activity`
  - Returns latest 20 agent activities.
- `GET /api/ai/articles/drafts`
  - Returns unpublished AI-generated drafts.
- `POST /api/ai/articles/publish`
  - Body: `id`.
  - Sets `published: true`.

## Known Issues / Sharp Edges

- PostgreSQL migration is still pending. `DATABASE_URL` currently points to local SQLite; a real Neon/PostgreSQL connection string is required before changing `prisma/schema.prisma` provider and running Prisma migration commands.
- `ChatWidget` still exists in `src/components/ChatWidget.tsx`, but the home page no longer renders it. `ChatAssistant` is the active global chat UI and consumes JSON from `/api/ai/chat`.
- Several files contain mojibake in comments or UI text, such as `â€”`, `âœ¦`, `Â·`, `â—†`, and similar. This likely came from an encoding mismatch.
- `NewsCard` mutates DOM with `wrapper.innerHTML` inside image `onError`, which bypasses React and can be fragile.
- AI routes now return structured fallback responses when Ollama is unavailable, but batch/agentic routes may still need broader graceful-degradation work.
- ESLint currently fails on existing debt in files such as `src/app/admin/newsroom/page.tsx`, `src/app/ai-news/page.tsx`, `src/app/digest/page.tsx`, `src/components/ChatWidget.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/lib/fetchFeeds.ts`, and `src/lib/ollama.ts`.

## Development Conventions Seen In Repo

- Uses App Router server components by default, with `"use client"` for interactive components.
- Uses direct Prisma calls in server pages and route handlers.
- Serializes `Date` objects before passing to client admin components.
- Most styling is inline object styles with CSS variables from `globals.css`.
- Path alias `@/` is preferred for `src` imports.
- Public pages use `dynamic = "force-dynamic"` where DB freshness matters.
- Some pages still export `revalidate`, but with `force-dynamic` freshness is explicit.
- Next docs consulted for the 2026-05-31 auth changes:
  - `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
  - `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`

## Latest Verification

2026-05-31:

- `npx tsc --noEmit` passed.
- `npm run lint` failed on existing lint debt listed in Known Issues.
- Security patch update:
  - Added `CRON_SECRET` to local `.env`.
  - Added local `.env` entries for `OLLAMA_HOST`, `OLLAMA_MODEL_CHAT`, and `OLLAMA_MODEL_MANAGER` using an installed `llama3.2` model.
  - Hardened the admin cookie from `sameSite=lax` to `sameSite=strict`.
  - Changed `src/proxy.ts` to default export.
  - Added shared `src/lib/adminAuth.ts`.
  - Added independent admin auth checks to `/api/admin/ping` and `/api/admin/purge`.
  - Removed `AdminSidebar` effect-driven state initialization; collapsed state is now derived from a lazy initializer and active route remains derived from `usePathname()`.
  - Runtime checks against existing dev server on `http://localhost:3000`:
    - `/admin` without auth returned `307` to `/admin/login?next=%2Fadmin`.
    - Unauthenticated `GET /api/admin/ping?url=https://feeds.bbci.co.uk/news/world/rss.xml` returned `401`.
    - Unauthenticated `DELETE /api/admin/purge?days=999999` returned `401`.
    - Authenticated `GET /api/admin/ping?url=https://feeds.bbci.co.uk/news/world/rss.xml` returned `200`.
    - Login via `/api/admin/auth` returned `200`; same session loaded `/admin` with Dashboard content.
    - Browser login flow reached `http://localhost:3000/admin`, Dashboard heading was visible, and browser console error count was 0.
- Runtime checks against existing dev server on `http://localhost:3000`:
  - `/admin` without auth returned `307` to `/admin/login?next=%2Fadmin`.
  - `DELETE /api/admin/articles` without auth returned `401`.
  - `POST /api/admin/auth` with the configured secret returned `200` and set a cookie.
  - Authenticated `GET /api/admin/ping?url=http://localhost` returned `403`.
  - Authenticated `GET /api/admin/ping?url=https://feeds.bbci.co.uk/news/world/rss.xml` returned `200`.
  - Authenticated `DELETE /api/admin/articles` without target or `confirm=true` returned `400`.
  - Browser smoke check confirmed `/admin` redirects to login and the login heading is visible.

## How To Keep This File Updated

After every edit:

1. Update the relevant section above with changed files, behavior, new APIs, new env vars, known issues fixed/added, and commands/tests run.
2. If the change touches Next.js behavior, mention which local Next docs were consulted.
3. Keep this file factual and concise. It is a map, not a changelog.

# LivePulse Project Knowledge

Last updated: 2026-06-07

This file is the working project memory for LivePulse. Update it after every code edit so future work can start here before re-reading the full repository.

## Agent Rule

- This project uses Next.js `16.2.3`, which has breaking changes from older Next versions.
- Before changing Next routing, rendering, data fetching, metadata, instrumentation, server actions, middleware, or config behavior, read the relevant local docs under `node_modules/next/dist/docs/`.
- The docs index includes an agent hint: slow client-side navigation fixes may need `unstable_instant`, not only `Suspense`; read `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.mdx` if touching that area.

## Project Summary

LivePulse is a Next.js App Router news aggregator with:

- RSS ingestion from configured global news feeds.
- Prisma + PostgreSQL persistence.
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
- Database: Prisma `5.22.0` with PostgreSQL via `DATABASE_URL`.
- RSS: `rss-parser`.
- Dates: `date-fns`.
- AI backend: local Ollama HTTP API, default host `http://localhost:11434`.
- `OLLAMA_FAST_MODEL` should use a model that supports `/api/generate` and JSON mode. Locally, `gemma4:e4b` is confirmed working; `phi3:3.8b` is installed but returns `"does not support generate"` and breaks sentiment/tag generation.

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
- `OLLAMA_HOST`
- `OLLAMA_DIGEST_MODEL`
- `OLLAMA_SUMMARY_MODEL`
- `OLLAMA_CHAT_MODEL`
- `OLLAMA_MANAGER_MODEL`
- `OLLAMA_FAST_MODEL`
- `ADMIN_SECRET`
- `CRON_SECRET`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`

Do not write secret values into this file.

## Important Config

- `next.config.ts`: enables `reactCompiler: true`; `experimental` is currently empty.
- `tsconfig.json`: path alias `@/*` maps to `./src/*`; includes `.next/types` and `.next/dev/types`.
- `eslint.config.mjs`: uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- `vercel.json`: cron schedule hits `/api/sync` every 5 minutes.
- `src/proxy.ts`: Next 16 Proxy auth gate for `/admin/:path*`, `/api/admin/:path*`, and user-only pages (`/profile`, `/onboarding`, `/bookmarks`, `/settings`). Admin routes use `ADMIN_SECRET`; user routes use Neon Auth when configured.
- `src/instrumentation.ts`: when `NEXT_RUNTIME === "nodejs"` and `NODE_ENV === "development"`, dynamically imports `startAutoSync()` and starts a local server-side sync loop. Production relies on Vercel cron.

## Recent UI Polish

2026-06-07:

- Public mobile readiness:
  - Consulted `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` before changing viewport metadata.
  - Added explicit `export const viewport` in `src/app/layout.tsx`, Google Fonts preconnects, `100dvh` body height, and cleaned the footer copyright mojibake.
  - Expanded `src/app/globals.css` with mobile/tablet utilities: `-webkit-fill-available`, `100dvh`, `.scroll-row`, mobile-safe 16px inputs, touch-action hints, focus-visible styling, public header classes, article grid/card sizing, digest/search/auth/detail responsive rules, full-screen mobile chat overlay, safe-area offsets, and landscape phone handling.
  - Added `src/components/MobileHeaderMenu.tsx` for the mobile public header dropdown with ARIA state, outside-click close, Escape close, and menu-link close behavior.
  - Updated public surfaces to use the mobile classes: `Header`, home, topic, search, tag, bookmarks, digest, AI-news, news detail, login, signup, `TopicTabs`, `NewsGrid`, `NewsCard`, `ArticleFeed`-backed pages, `DigestClient`, `ChatAssistant`, and `ArticleAiPanel`.
  - Feed card images now use `loading="lazy"` and `decoding="async"`; public detail hero images use `loading="eager"` and `decoding="async"` because they are above the fold.
  - Article detail chat inputs scroll into view on focus to reduce keyboard overlap on mobile.
  - Cleaned public mojibake scan: `rg -n "â|Â" src -g "*.tsx" -g "*.css"` returns no matches.
  - Verification: `npx tsc --noEmit` passed and `npm run build` passed.
  - `npm run lint` still fails on existing backlog: `src/app/admin/newsroom/page.tsx` `any`, dead `src/components/ChatWidget.tsx` apostrophes, `src/components/admin/AdminSidebar.tsx` set-state-in-effect, plus expected `<img>` warnings for arbitrary RSS images and the font-link warning.
  - Browser/mobile screenshot QA was not completed because the in-app browser Node runtime crashed with `windows sandbox failed: spawn setup refresh`.
- Mobile touch hotfix:
  - `src/components/NewsCard.tsx` action controls now stop pointer/touch propagation as well as click propagation, so tapping bookmark/tags/mood/AI/tag chips on mobile does not accidentally activate the surrounding article/card interaction.
  - NewsCard footer action buttons now use 44px minimum touch targets with inline-flex centering.
  - Cleaned NewsCard footer mojibake glyphs for read marker, bookmark stars, and sentiment checkmark.
  - Verification: `npx tsc --noEmit` passed and `npm run build` passed.
- NewsCard strict mobile touch follow-up:
  - Confirmed the `<article>` card has no `onClick`, `onTouchStart`, or `onTouchEnd`; changed the card cursor from pointer to default so only the title link presents as navigable.
  - Updated summarize, sentiment, tag generation, and bookmark handlers to accept mouse or touch events and begin with `stopPropagation()` then `preventDefault()`.
  - Added `card-image`, `card-footer`, `card-date`, and `card-action-btn` classes; footer actions have `touchAction: "manipulation"` and transparent iOS tap highlights.
  - Added CSS to suppress full-card iOS tap flash/long-press callout, re-enable subtle tap highlights only on real card links/buttons, disable card hover/zoom effects on mobile, keep action buttons visible, and wrap the mobile footer into date row plus equal-width action row.
  - Sentiment and AI image overlays now use `pointerEvents: "none"` and `userSelect: "none"` so they cannot steal taps.
  - Verification: `npx tsc --noEmit` passed and `npm run build` passed.
- Mobile frontend surgical fixes:
  - `MobileHeaderMenu` now renders clean `☰` and `✕` glyphs instead of mojibake.
  - `onboarding/page.tsx` now uses `100dvh`, clamp-based outer/panel padding, auto-fill 140px choice grids, and `onboarding-choice-grid` class hooks.
  - `news/[id]/page.tsx` now uses clamp-based detail padding, clamp-based hero image height, responsive `agent-analysis-grid`, and an `article-cta-btn` hook for mobile full-width CTA behavior.
  - `/ai-news` and `/ai-news/[id]` titles now use `fontSize: "clamp(24px, 5vw, 48px)"` instead of fixed 48px.
  - `NewsCard` image fallback no longer assigns `wrapper.style.height = "180px"`, so CSS controls fallback height on mobile.
  - `DigestClient` now exposes `digest-btn` and `digest-content-area` hooks; mobile CSS reduces digest padding and makes the generate button full-width/44px.
  - `globals.css` mobile block now includes exact hero/page/header padding overrides plus article CTA, article hero, agent analysis, onboarding grid, and digest-specific overrides.
  - Verification: `npx tsc --noEmit` passed after every changed file; final `npx tsc --noEmit` passed; `npm run build` passed; `rg -n "â|Â|Ã" src/app src/components -g "*.tsx"` returned no matches.
- AI chat streaming:
  - Added `ollamaChatStream()` in `src/lib/ollama.ts` for `/api/chat` streaming with newline-delimited JSON buffering.
  - `/api/ai/manager`, `/api/ai/chat`, and `/api/ai/article-chat` now return SSE events: `start`, `token`, `done`, and `error`.
  - `AiManagerClient`, `ChatAssistant`, and `ArticleAiPanel` now show immediate thinking dots, stream tokens into a live response bubble, keep input disabled until completion, show a blinking cursor while streaming, and auto-scroll as content arrives.
  - Global `thinking-dot` and `cursor-blink` keyframes were added to `src/app/globals.css`.
  - Local Next docs consulted before route/client edits:
    - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
    - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - Verification: `npx tsc --noEmit` passed.

2026-06-06:

- RAG foundation:
  - Added pgvector-backed `ArticleEmbedding` schema and migration for semantic article chunks.
  - Added `src/lib/textSafety.ts` for shared AI/RAG sanitization: decode entities, strip tags/angle brackets, redact prompt-injection patterns, and cap text length.
  - Added `embedText()` in `src/lib/ollama.ts` using `OLLAMA_EMBED_MODEL` (`nomic-embed-text` by default), a 5-minute SHA-256 keyed embedding cache, vector length validation, and AiLog failure logging.
  - Added `src/lib/rag.ts` with article chunking, SHA-256 content hashes, indexing helpers, pgvector retrieval, article deduplication, XML-style retrieved context, and citation extraction.
  - Added admin RAG APIs:
    - `POST /api/admin/rag/reindex` supports `missing`, `recent`, `article`, and `all` modes with inline admin auth and a hard limit cap of 100.
    - `GET /api/admin/rag/status` returns coverage, chunk count, embedding model, latest index time, and last error.
  - Added `RagAdminPanel` to `/admin/ai-manager` for status and reindex actions.
  - `/api/ai/chat` and `/api/ai/article-chat` now try RAG first, use `MODELS.CHAT`, return `contextStats`, enforce 10 requests/minute/IP, and fall back to the previous Prisma latest/topic context when embeddings are unavailable.
  - `/api/sync` and development autosync trigger non-blocking background reindex of missing embeddings after RSS sync; dev autosync also warms the embedding model after the first successful sync.

- Article chat context expansion:
  - Replaced `POST /api/ai/article-chat` with a richer article context engine: focus article, 10 same-topic recent articles, and 5 global headlines from different topics.
  - Removed the restrictive article-chat system prompt wording that told the model to answer only from the single article excerpt.
  - `ArticleAiPanel` now sends both `articleId` and `topic` to `/api/ai/article-chat`, and its visible chat copy now reflects related coverage and broader headlines.
  - `/api/ai/chat` now retrieves 25 published articles, includes `description`, `pubDate`, and `sentiment`, and uses softer out-of-context wording that offers related available coverage.
  - Known limitation documented: this is topic-filtered Prisma context retrieval, not semantic vector RAG or ChromaDB.
  - Local Next docs consulted before route/client edits:
    - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
    - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

- Chat UI contrast fix:
  - `src/components/ArticleAiPanel.tsx`: article-aware chat now uses high-contrast assistant and user bubbles, formatted AI response rendering for bullets/headings, connected input/button styling, and dimmer helper/header text.
  - `src/components/ChatAssistant.tsx`: global floating chat was rebuilt with the same high-contrast bubble system, formatted assistant responses, connected input/button styling, and a cleaner ASCII floating trigger.
  - Assistant response body text now uses `var(--text)` instead of muted/accent color; accent is reserved for borders, bullets, controls, and labels.
  - Verification: `npx tsc --noEmit` passed.
- Bluewall v2 security remediation:
  - `src/lib/adminSessions.ts` now issues stateless signed 64-character admin session tokens; `admin_token` no longer stores the raw `ADMIN_SECRET`.
  - `src/lib/adminAuth.ts` validates admin cookies through `validateAdminSession()` and still accepts `Authorization: Bearer <ADMIN_SECRET>` for admin API automation.
  - `src/app/api/admin/logout/route.ts` clears the admin session cookie.
  - `src/app/api/ai/chat/route.ts` and `src/app/api/ai/article-chat/route.ts` filter client chat messages to `user`/`assistant`, strip angle brackets, and cap message content at 2000 chars.
  - `src/app/api/ai/summarize/route.ts`, `src/app/api/ai/sentiment/route.ts`, and `src/app/api/ai/tag/route.ts` use client-provided `id` only, then fetch published article title/description/topic from Prisma for prompts.
  - `src/lib/fetchFeeds.ts` decodes HTML entities before stripping tags, removes remaining angle brackets, redacts prompt-injection patterns, and truncates descriptions at 500 chars.
  - `/api/sync` no longer has a development bypass when `CRON_SECRET` exists.
  - `/api/admin/purge` clamps `days` to `1..365` and returns a preview unless `confirm=true` is present.
  - `/api/ai/batch` caps `limit` to `1..50`, defaulting invalid values to 20.
  - API route handlers no longer return `String(error)` / `String(e)` in JSON responses.
  - Verification: source scans for raw cookie comparison, `String(error)`, stale digest env names, and sync `isDev` bypass passed; `npx tsc --noEmit` passed.
- Admin settings React warning fix:
  - `src/components/admin/SettingsClient.tsx` now sets the sync interval selection with `defaultValue="5"` on `<select>` instead of `selected` on an `<option>`.
  - Verification: no `<option selected>` matches remain in `src/**/*.tsx`; `npx tsc --noEmit` passed.

2026-06-05:

- AI typography refresh:
  - `src/app/layout.tsx`: Google Fonts request now includes Inter.
  - `src/app/globals.css`: added `--font-ai` for modern AI-generated prose.
  - `src/components/ArticleAiPanel.tsx`: summary bullets, helper text, article-aware chat bubbles, and chat input now use `var(--font-ai)` with more readable spacing/weight.
  - `src/components/ChatAssistant.tsx`: floating AI chat message bubbles and input now use `var(--font-ai)`.
  - `src/components/DigestClient.tsx`: digest body now uses `var(--font-ai)` instead of the missing/old `IBM Plex Sans` reference.
  - `src/components/NewsCard.tsx`: inline card AI summaries now use `var(--font-ai)` instead of mono.
  - Verification: `npx tsc --noEmit` passed.
- Phase 2 screenshot polish applied surgically:
  - `src/app/page.tsx`: tightened hero strip padding to `32px 32px 20px`, reduced article section top padding to 20px, strengthened the subtle blue radial glow, moved the stats line above filters, and changed sentiment filters to small pill chips.
  - `src/app/globals.css`: brightened dark surface/border tokens and added CSS suppression for Neon Auth floating dev widgets.
  - `src/components/NewsCard.tsx`: added card gradient depth, persistent/hover shadows, `minHeight: 420`, top-biased image positioning, and textured no-image fallback.
  - `src/components/NewsGrid.tsx`: changed public grid columns to `repeat(auto-fill, minmax(340px, 1fr))` with 24px gaps.
  - `src/components/TopicTabs.tsx`: active topic tabs now use the same subtle accent-tint pill treatment as filters.
  - `src/app/topic/[slug]/page.tsx`: topic-page sentiment filters now match the home page chip styling.
- Verification: read Next 16 dynamic route docs before touching `src/app/topic/[slug]/page.tsx`; `npx tsc --noEmit` passed after each fix and after the final sweep. Browser screenshot verification could not run because the in-app browser runtime failed with `spawn setup refresh`.

## Data Model

Prisma schema: `prisma/schema.prisma`.

Models:

- `NewsArticle`
  - Core fields: `id`, `title`, `description`, `link`, `pubDate`, `source`, `topic`, `slug`, `image`, `fetchedAt`.
  - AI fields: `summary`, `sentiment`, `aiTags`, `aiProcessed`, `aiGenerated`.
  - Agentic fields: `factScore`, `biasAnalysis`, `agentNotes`, `published`, `scored`.
  - Indexes: `topic`, `slug`, `fetchedAt`, `[published, pubDate desc]`, `[topic, published, pubDate desc]`, `[published, fetchedAt desc]`; `link` is unique.
  - Relations: `bookmarks`, `reads`.
- `AgentActivity`
  - Logs agent work for Scout, Fact-Checker, Spin-Doctor, etc.
- `DailyDigest`
  - One digest per date string such as `2026-03-27`.
- `AiLog`
  - Logs AI actions, model, prompt snippet, token count, timing, success/error.
- `UserProfile`
  - App-owned personalization profile keyed by Neon Auth `userId`; stores `country`, `region`, `city`, and `onboarded`.
- `UserTopicFollow`
  - App-owned topic follow rows keyed by Neon Auth `userId`; unique on `[userId, topicSlug]`.
- `UserBookmark`
  - App-owned bookmark rows keyed by Neon Auth `userId`; relates to `NewsArticle` by `articleId`; unique on `[userId, articleId]`.
- `UserArticleRead`
  - App-owned read-history rows keyed by Neon Auth `userId`; relates to `NewsArticle` by `articleId`; unique on `[userId, articleId]`.
- `FeedSource`
  - Database-backed RSS source catalog with `name`, `url`, `topic`, `slug`, `region`, `enabled`, `priority`, `lastFetched`, `lastStatus`, and `failCount`.
  - Indexed by `topic`, `region`, and `enabled`.

## Auth

- Admin auth remains separate: a single `ADMIN_SECRET` checked by `src/lib/adminAuth.ts`, `src/proxy.ts`, and guarded admin API handlers.
- Public user auth uses Neon Auth via `@neondatabase/auth`.
- `src/lib/auth.ts` exports the Neon Auth singleton, `isNeonAuthConfigured()`, and `getCurrentUserId()`.
- `getCurrentUserId()` and `getCurrentUser()` are read-only Server Component-safe helpers. They verify the cached Neon `session_data` JWT cookie and do not call `auth.getSession()`, because `auth.getSession()` may refresh cookies and Next.js forbids cookie mutation during Server Component render.
- `getMutableCurrentUserId()` calls `auth.getSession()` and should only be used in Route Handlers or Server Actions where cookie mutation is allowed.
- `src/app/api/auth/[...path]/route.ts` proxies Neon Auth endpoints through `auth.handler()`.
- `src/app/login/page.tsx` and `src/app/signup/page.tsx` use server actions with `auth.signIn.email()` and `auth.signUp.email()`.
- After successful signup, `src/app/signup/page.tsx` redirects to `/onboarding`.
- `src/components/AuthNav.tsx` renders sign-in/sign-up links or the signed-in user plus a sign-out form.
- Neon Auth requires `NEON_AUTH_BASE_URL` from the Neon dashboard. Until it is set, login/signup pages render a setup error instead of attempting upstream auth.
- `src/app/api/user/preferences/route.ts` reads the Neon Auth session, returns current profile/topic preferences, and upserts `UserProfile` plus synced `UserTopicFollow` rows.
- `src/app/onboarding/page.tsx` lets signed-in users choose a region and followed topics, then POSTs to `/api/user/preferences`.
- `src/app/profile/page.tsx` lets signed-in users view name/email, edit region and followed topics, save preferences, and sign out.
- `src/lib/feed.ts` builds the personalized published-article query, applying followed-topic filtering, India-region topic inclusion, read markers, and bookmark markers.
- `src/app/api/user/read/route.ts` records read history for signed-in users and returns `401` for logged-out users.
- `src/app/api/user/bookmarks/route.ts` supports signed-in bookmark list/create/delete operations.
- `src/app/bookmarks/page.tsx` renders the signed-in user's saved articles with `NewsCard`.
- `src/components/NewsCard.tsx` can toggle bookmarks, fire read tracking when opening article links, dim read articles, and show a `READ` label.
- `src/components/TopicTabs.tsx` renders the reusable horizontal topic navigation, with `/` as `all` and `/topic/[slug]` for topic pages.
- `src/components/SearchBar.tsx` renders the header search input and navigates to `/search?q=...`.
  - Uses a plain `<style>` block for responsive behavior; do not use `style jsx` here because it caused a React hydration className mismatch in Next 16/Turbopack.
- `src/components/NewsGrid.tsx` renders article cards, skeleton cards for loading, and an empty state.
- `src/app/api/search/route.ts` searches published articles across title, description, source, and topic.
- `src/app/search/page.tsx` renders search results with `NewsGrid` and a no-results state.
- `src/lib/ollama.ts` includes Ollama response bodies in thrown `/api/generate` errors so server logs show exact model/endpoint incompatibilities.
- Public article lists now use cursor-based "Load More" pagination.
  - `src/lib/paginatedFeed.ts` owns the shared query layer, opaque cursor encoding, `NewsItem` serialization, read/bookmark flags, and scope-specific filtering.
  - `src/app/api/feed/route.ts` powers client-side loading for `home`, `topic`, `search`, `tag`, `ai-news`, and `bookmarks` scopes.
  - `src/components/ArticleFeed.tsx` renders `NewsGrid`, appends fetched pages, dedupes appended articles by `id`, and shows loading/error/end states.
  - Public pages render the first page server-side at 24 articles, then use `ArticleFeed` for additional pages.
- Soft registration wall:
  - `src/components/Regwall.tsx` renders the reusable sign-up/sign-in prompt with `next` links back to the current path.
  - `src/components/ArticleFeed.tsx` accepts `registrationRequired`; when true, logged-out users can view the server-rendered first page but clicking `Load More` opens the regwall instead of calling `/api/feed`.
  - `/`, `/topic/[slug]`, `/search`, `/tag/[tag]`, and `/ai-news` pass `registrationRequired={isNeonAuthConfigured() && !userId}` so the wall only appears when Neon Auth is configured. `/bookmarks` remains a protected route and redirects to login.

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
- `health`
- `climate`
- `politics`

Hardcoded bootstrap feed count: 13.

Database-backed source catalog:

- `src/lib/seedSources.ts` seeds 33 feeds across `world`, `technology`, `india`, `business`, `science`, `sports`, `health`, `climate`, and `politics`.
- `src/app/api/admin/seed-sources/route.ts` runs source seeding behind admin auth.
- `src/app/api/admin/sources/route.ts` supports admin-authenticated source list/create/update/delete.
- `src/app/api/sync/route.ts` reads enabled `FeedSource` rows ordered by priority and falls back to hardcoded `FEED_SOURCES` only when the DB source table is empty.
- After sync, `FeedSource.lastFetched`, `lastStatus`, and `failCount` are updated from per-source fetch results.
- `src/app/api/admin/ping/route.ts` allowlists DB source hostnames when sources exist, with hardcoded source hostnames as a bootstrap fallback.

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
  - Normalizes invalid or missing feed item dates to the current timestamp so malformed RSS dates do not crash an entire feed.
  - Canonicalizes article links before hashing/storing by stripping fragments and common tracking query params.
  - Returns max 15 items per source.
  - Dedupes by canonical link and exact normalized title within the same topic before articles enter sync.
  - Failed feeds are logged as concise warnings and reported through `failedNames` for source health updates.
- `src/lib/autoSync.ts`
  - Runs the RSS sync directly in-process instead of calling `/api/sync` over HTTP, avoiding dev-server bootstrap races where port 3000 is not listening yet.
  - Uses enabled `FeedSource` rows ordered by priority, with hardcoded `FEED_SOURCES` fallback only when the DB source table is empty.
  - Updates per-source `lastFetched`, `lastStatus`, and `failCount`, upserts articles by link, lowercases topics, and deletes non-AI articles older than 3 days.
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
  - Dynamic page; reads latest 200 `NewsArticle` rows from Prisma with `where: { published: true }`.
  - If DB is empty or read fails, fetches live RSS directly.
  - Renders `Header`, topic tabs, article grid, and `NewsCard`.
- `/topic/[slug]`
  - File: `src/app/topic/[slug]/page.tsx`.
  - Dynamic page.
  - Uses Next 16-style `params: Promise<{ slug: string }>` and awaits it.
  - Calls `notFound()` for invalid slugs.
  - `/topic/all` reads published articles across all slugs.
  - Other topic pages read up to 100 articles matching `slug` and `published: true`.
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
  - Accepts `Authorization: Bearer <ADMIN_SECRET>` or an `admin_token` signed session cookie validated by `src/lib/adminSessions.ts`.
  - Unauthorized admin pages redirect to `/admin/login?next=<path>`.
  - Unauthorized admin APIs return `401 { "error": "Unauthorized" }`.
- `/admin/login`
  - Client login form that posts `{ password }` to `/api/admin/auth`.
  - Successful auth sets an httpOnly random-session `admin_token` cookie and redirects to requested admin page or `/admin`.
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
  - Client polls `/api/admin/ai/newsroom/activity` and `/api/admin/ai/drafts` every 15 seconds with an `AbortController`.

## API Routes

- `GET /api/sync`
  - Fetches all RSS feeds and upserts articles by unique `link`.
  - In production, if `CRON_SECRET` exists, requires `Authorization: Bearer <CRON_SECRET>`.
  - Deletes articles where `fetchedAt` is older than 3 days.
  - Returns `{ success, saved, skipped, total }`.
- `DELETE /api/admin/articles`
  - Query params: `id`, `topic`.
  - Deletes one article or all in a topic.
  - Independently checks `isAdminAuthorized(request)` before deleting.
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
- `GET /api/admin/ai/drafts`
  - Admin-only replacement for old `/api/ai/articles/drafts`.
  - Returns `aiGenerated: true` and `published: false` articles.
- `POST /api/admin/ai/publish`
  - Admin-only replacement for old `/api/ai/articles/publish`.
  - Body: `id`; sets `published: true`.
- `POST /api/admin/ai/unpublish`
  - Body: `id`; sets `published: false`.
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
  - Independently checks `isAdminAuthorized(request)`.
- `POST /api/ai/newsroom/process`
  - Runs full agentic cycle.
- `GET /api/admin/ai/newsroom/activity`
  - Admin-only route that returns latest 20 agent activities.
- `GET /api/ai/newsroom/activity`
  - Legacy route. Requires admin auth and returns `410` after auth; unauthenticated requests return `401`.
- `GET /api/ai/articles/drafts`
  - Removed. Use `/api/admin/ai/drafts`.
- `POST /api/ai/articles/publish`
  - Removed. Use `/api/admin/ai/publish`.

## Known Issues / Sharp Edges

- Article chat uses topic-filtered Prisma queries for context retrieval (Layer 1: focus article, Layer 2: same-topic recent articles, Layer 3: global headlines). True semantic RAG via ChromaDB is not yet implemented. Questions about articles outside the current topic may not have full context.
- `SECURITY_REPORT.md` is the current security-measures audit report. As of 2026-06-03, the previously confirmed code gaps are fixed:
  - `/api/ai/manager` now returns `401` without admin auth.
  - `/api/ai/newsroom/activity` now returns `401` without admin auth, and the active admin UI route is `/api/admin/ai/newsroom/activity`.
  - `/api/admin/articles` now has an independent `isAdminAuthorized()` check.
  - `next.config.ts` now defines global CSP, frame, content-type, referrer, and permissions-policy headers.
  - Remaining checks: verify Vercel env vars, especially `CRON_SECRET`, and re-run authenticated DB-backed smoke tests once Neon connectivity is available.
- `SECURITY_REMEDIATION_PLAN.md` is the follow-up plan derived from `SECURITY_REPORT.md`. It sequences fixes as: protect `/api/ai/manager`, protect or move `/api/ai/newsroom/activity`, add local auth to `/api/admin/articles`, add global security headers, manually verify Vercel env vars, then re-run and update the audit report.
  - 2026-06-03 update: local code remediation is complete for manager auth, newsroom activity auth, admin articles defense-in-depth, and security headers. Remaining items are manual Vercel env verification and authenticated DB-backed smoke tests once Neon connectivity is available.
- Local authenticated DB-backed security smoke tests currently fail after auth because Prisma cannot reach the Neon host in `DATABASE_URL`; re-test when Neon connectivity is available.
- `ChatWidget` still exists in `src/components/ChatWidget.tsx`, but the home page no longer renders it. `ChatAssistant` is the active global chat UI and consumes JSON from `/api/ai/chat`.
- Several files contain mojibake in comments or UI text, such as `â€”`, `âœ¦`, `Â·`, `â—†`, and similar. This likely came from an encoding mismatch.
- AI routes now return structured fallback responses when Ollama is unavailable, but batch/agentic routes may still need broader graceful-degradation work.
- ESLint currently fails on existing debt in files such as `src/app/admin/newsroom/page.tsx`, `src/app/ai-news/page.tsx`, `src/app/digest/page.tsx`, `src/components/ChatWidget.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/lib/fetchFeeds.ts`, and `src/lib/ollama.ts`.
  - `src/components/admin/AdminSidebar.tsx` no longer has the set-state-in-effect error as of the publishing pipeline patch.

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

2026-06-05:

- Operation Bluewall security remediation:
  - Added `PENTEST_REPORT.md` with a remediation status table for ANTI-001 through ANTI-020 and final verification evidence.
  - `DELETE /api/ai/digest` now requires admin auth; public `GET /api/ai/digest` remains available.
  - `/api/sync` no longer has a development bypass for `CRON_SECRET`.
  - Added `POST /api/admin/sync`, protected by `isAdminAuthorized()`, so the admin dashboard can run manual sync without exposing `CRON_SECRET` to the client.
  - `AdminSync` now calls `/api/admin/sync` instead of `/api/sync`.
  - `/api/ai/batch` caps requested `limit` to the range `1..50`.
  - `src/lib/fetchFeeds.ts` now decodes HTML entities before tag stripping, strips remaining angle brackets, redacts common prompt-injection phrases, exports `cleanDescription()`, and applies similar cleaning to RSS titles.
  - `/api/ai/chat` now validates topics, strips client-supplied `system` roles, caps message length, keeps only the latest 20 messages, and strips angle brackets from client message content.
  - `src/lib/agents.ts` now sanitizes article titles, sources, and descriptions before constructing Scout, Fact-Checker, and Spin-Doctor prompts.
  - Admin auth no longer stores the raw `ADMIN_SECRET` in `admin_token`; login now creates a stateless signed 64-character session token, while bearer auth still accepts `ADMIN_SECRET` for CLI/server use.
  - Admin login now validates request JSON, rejects invalid password shapes/oversized passwords, adds a constant 100ms response delay, and locks out a client IP after repeated failures.
  - Added `POST /api/admin/logout`, and `AdminSidebar` now includes a logout action that clears the admin cookie and redirects to `/admin/login`.
  - `DELETE /api/admin/purge` now clamps `days` to `1..365`, requires `confirm=true` to delete, previews deletion counts otherwise, and only purges non-AI articles by `fetchedAt`.
  - `/api/ai/summarize`, `/api/ai/sentiment`, and `/api/ai/tag` now validate the article exists with `published: true` and use DB title/description/topic fields instead of client-supplied prompt fields.
  - API route 500 responses no longer return `String(error)`; detailed errors are logged server-side and clients receive generic messages.
  - `next.config.ts` now disables/empties `X-Powered-By` in addition to the existing CSP, frame, content-type, referrer, and permissions-policy headers.
  - Admin login redirect hardening now rejects absolute URLs, protocol-relative URLs, backslashes, and non-`/admin` paths.
  - Verification: `npx tsc --noEmit` passed; full Phase 0 sensitive endpoint rerun returned `401` for all protected endpoints; `/admin` no cookie returned `307`; login session cookie did not contain `ADMIN_SECRET`; `/admin` with session returned `200`; logout cleared access; six bad login attempts from a synthetic IP returned `401,401,401,401,401,429`; `/api/sync` with `CRON_SECRET` returned `200`; headers were present on `/`.

- UI/UX polish sprint:
  - Replaced the global design tokens in `src/app/globals.css` with the "Dark Editorial Intelligence" palette, typography variables, spacing scale, scrollbar/selection styling, focus styling, utility classes, and `pulse-live` animation.
  - Updated `src/app/layout.tsx` to load IBM Plex Mono, IBM Plex Serif, and Playfair Display from Google Fonts, use a flex body shell, and render the minimal global footer.
  - Rebuilt `src/components/Header.tsx` as a sticky blurred two-row editorial header with date, LIVE indicator, centered italic wordmark, primary navigation, saved/search links, and the existing `AuthNav`.
  - Restyled `src/components/NewsCard.tsx` while preserving its existing state, handlers, safe image fallback, read tracking, bookmark toggling, summary, sentiment, and tag-generation behavior. Cards now have hover lift, image zoom, overlaid sentiment/AI pills, footer actions, and clickable tag chips.
  - Updated the home page JSX shell with the global intelligence hero strip, editorial headline, topic tabs, sentiment filter bar, and existing paginated `ArticleFeed`.
  - Updated `NewsGrid` spacing to match the card-grid target.
  - Restyled `/login` and `/signup` with the shared centered auth shell while preserving existing Neon Auth server actions and redirects.
  - Restyled `/onboarding` with region and topic selection grids while preserving the existing preferences POST flow.
  - Rebuilt `/news/[id]` JSX with the premium article shell, Playfair title, serif excerpt, existing `ArticleAiPanel`, large agent fact-score panel, source CTA, and existing related-coverage helper.
  - Verification: `npx tsc --noEmit` passed after each surface group and after the article-detail update.

2026-06-02:

- AutoSync bootstrap-race fix:
  - Replaced the self-HTTP call from `src/lib/autoSync.ts` to `${NEXT_PUBLIC_BASE_URL}/api/sync` with a direct in-process sync using `fetchFeedsWithStatus()` and Prisma.
  - AutoSync now mirrors DB-backed source behavior from `/api/sync`, including enabled-source selection, hardcoded source fallback, source health updates, article upserts, lowercase topics, and old non-AI article cleanup.
  - Verification: `npx tsc --noEmit` passed.
- RSS parser robustness fix:
  - Fixed `src/lib/fetchFeeds.ts` so truthy but invalid `item.pubDate` values fall back to the current timestamp instead of throwing `RangeError: Invalid time value`.
  - Changed failed-source logging from stack-trace `console.error` output to concise `console.warn` messages; source health still receives failed source names.
  - Verification: `npx tsc --noEmit` passed.
- RSS source refresh and dedupe hardening:
  - Replaced stale failing source URLs in `src/lib/seedSources.ts` and the live `FeedSource` table:
    - Reuters World now uses `https://openrss.org/feed/www.reuters.com/world/`.
    - AP News now uses `https://openrss.org/feed/apnews.com/hub/ap-top-news`.
    - CNBC Business now uses `https://www.cnbc.com/id/10001147/device/rss/rss.html`.
    - Politico now uses `https://rss.politico.com/politics-news.xml`.
    - Medical News Today was replaced with Healthline News at `https://www.healthline.com/rss/health-news`.
    - NHS UK was replaced with NHS Digital at `https://digital.nhs.uk/feed/all-blog-feed.xml`.
    - The Wire India was replaced with The Wire Science at `https://science.thewire.in/feed/`.
    - ESPN was replaced with CBS Sports at `https://www.cbssports.com/rss/headlines/`.
  - Updated hardcoded fallback sources in `src/lib/sources.ts` for CNBC Business and CBS Sports.
  - Hardened `src/lib/fetchFeeds.ts` duplicate prevention by canonicalizing links and dropping exact normalized duplicate titles within the same topic.
  - Database scan before cleanup showed 0 duplicate exact links and 114 duplicate normalized titles among 976 articles, mostly same-source repeats with different links.
  - Verification: replacement URLs parsed with `rss-parser`; `npx tsc --noEmit` passed; live `/api/sync` returned `{"success":true,"saved":452,"skipped":0,"total":452,"sources":{"ok":33,"failed":0}}`.
- Public feed pagination:
  - Added cursor-based "Load More" pagination with a default page size of 24 and ordering by `pubDate desc, id desc`.
  - Added `GET /api/feed` with scopes for home, topic, search, tag, AI news, and bookmarks. Bookmarks require a signed-in user and paginate by bookmark creation time.
  - Added `ArticleFeed` as the client pagination wrapper while keeping `NewsGrid` presentation-only.
  - Wired `/`, `/topic/[slug]`, `/search`, `/tag/[tag]`, `/ai-news`, and `/bookmarks` to server-render the first page and append later pages client-side.
  - Tag pagination safely parses `aiTags` JSON and skips malformed rows.
  - Verification: `npx tsc --noEmit` passed; temporary dev-server smoke tests returned `200` for `/`, `/api/feed?scope=home`, `/api/feed?scope=topic&topic=technology`, and `/api/feed?scope=search&q=climate`; cursor smoke test returned 24 articles on page 1, 24 on page 2, `hasMore: true`, and 0 duplicate IDs across both pages.
  - `npm run lint` still fails on existing lint debt in admin/newsroom, digest, ChatWidget, `fetchFeeds.ts`, and `ollama.ts`; no new pagination-specific lint errors were reported.
- Neon Auth Server Component cookie fix:
  - Fixed `Cookies can only be modified in a Server Action or Route Handler` on `/` by changing `getCurrentUserId()` to read and verify the cached Neon session-data JWT cookie instead of calling `auth.getSession()` during Server Component render.
  - Added `getCurrentUser()` for read-only header/user-label rendering and `getMutableCurrentUserId()` for Route Handlers that can safely refresh cookies.
  - Updated public feed/user/AI route handlers to use `getMutableCurrentUserId()`.
  - Updated `AuthNav` to use read-only `getCurrentUser()` instead of `auth.getSession()`.
  - Verification: `npx tsc --noEmit` passed; temporary dev-server smoke test returned `HOME_STATUS=200` and `FEED_STATUS=200` for `/api/feed?scope=home`.
- Sources/personalization/AI wiring Phase 1:
  - Added an independent `isAdminAuthorized(request)` guard to `POST /api/ai/batch`, because it lives outside the `/api/admin/*` proxy matcher.
  - Aligned digest model logging/storage with `OLLAMA_DIGEST_MODEL`; the stale `OLLAMA_MODEL_DIGEST` env name should no longer be read.
  - `ChatAssistant` now derives the active topic from `/topic/[slug]` using `usePathname()` and sends it as `topic` in the `/api/ai/chat` request body; non-topic pages send `all`.
  - Verification: `rg -n "OLLAMA_MODEL_DIGEST" src` returned zero matches; `npx tsc --noEmit` passed; unauthenticated `POST /api/ai/batch` returned `401 { "error": "Unauthorized" }`.
- Sources/personalization/AI wiring Phase 2:
  - Added Prisma `FeedSource` model and migration `20260602010750_add_feed_source_model`.
  - Added `src/lib/seedSources.ts` plus admin seed route `POST /api/admin/seed-sources`.
  - Converted `/api/sync` to use enabled DB sources ordered by priority, with hardcoded source fallback only when no DB sources exist.
  - Added per-source sync health updates for `lastFetched`, `lastStatus`, and `failCount`.
  - Added admin source CRUD route `src/app/api/admin/sources/route.ts`.
  - Reworked `/admin/sources` and `SourcesClient` to show database sources, region badges, status/fail count, add-source form, enable/disable toggles, ping actions, and delete for zero-article sources.
  - Updated `/admin/health`, `/admin`, and `/api/admin/ping` to use DB-backed sources.
  - Added public topic slugs `health`, `climate`, and `politics`.
  - Verification: `npx prisma migrate dev --name add-feed-source-model` applied and generated Prisma Client; `POST /api/admin/seed-sources` returned 200; `GET /api/admin/sources` returned 33 sources; test create/delete source returned 201/200; `/api/sync` returned 200 with 334 articles from DB sources and updated all 33 source statuses; `/topic/health`, `/topic/climate`, and `/topic/politics` returned 200; `npx prisma migrate status` reported the database up to date; `npx tsc --noEmit` passed.
- AI context quality Phase 3:
  - Scout generation now selects source and description snippets from its five context articles and includes those snippets in the writer prompt instead of titles only.
  - Digest generation now receives article descriptions and sentiment values and prompts the digest model to group by topic, include snippets, and note sentiment trends.
  - `/api/ai/digest` now builds per-user digest keys as `<date>-user-<userId>` for signed-in users, filters digest articles by followed topics when present, and uses the same personalized key for regeneration deletes.
  - `/api/ai/chat` now reads the signed-in user's followed topics and uses them for article context when the request topic is `all` or omitted; explicit `/topic/[slug]` requests still win.
  - Verification: `npx tsc --noEmit` passed; source checks confirmed Scout description selection, digest description/sentiment selection, personalized digest keys, and followed-topic chat filtering.
- Missing UI surfaces Phase 4:
  - Added `/tag/[tag]` browsing with exact case-insensitive JSON tag filtering over published articles and `NewsGrid` rendering.
  - `NewsCard` tag badges now link to `/tag/<tag>` and new Phase 2 topics have card colors/backgrounds.
  - Home and topic pages now accept `?sentiment=positive|neutral|negative`, pass it through `getPersonalisedFeed()`, and render sentiment filter links above the grid.
  - `getPersonalisedFeed()` now supports sentiment filtering and replaces the hardcoded India topic boost with a generic regional-source ordering boost from `FeedSource.region`.
  - AI report detail pages now show an agent analysis panel after the article body and render up to four related published articles from the same topic.
  - Verification: `npx tsc --noEmit` passed. Live tag/sentiment/region behavior remains data-dependent and should be smoke-tested with rows containing matching `aiTags`, `sentiment`, and user `region`.
- logAiAction coverage Phase 5:
  - `logAiAction()` now accepts the original positional signature and the object-style `{ action, model, prompt, tokens, ms, success, error }` signature.
  - `summarize`, `sentiment`, and `tag` routes now use `logAiAction()` instead of direct `prisma.aiLog.create()` calls and log unavailable-AI failures before returning 503.
  - `chat`, `digest`, and `manager` routes now log prompt previews and unavailable-AI failures as failed `AiLog` rows.
  - `runScoutGeneration()` now logs successful Scout generations and Scout failures.
  - `runFactChecker()` logs `fact-check` success/failure through `logAiAction()`.
  - `runSpinDoctor()` logs `spin-doctor` success/failure through `logAiAction()`.
  - Verification: `Select-String` confirmed `logAiAction` imports/calls in summarize, sentiment, tag, chat, digest, manager, and `src/lib/agents.ts`; `npx tsc --noEmit` passed.
- Soft regwall:
  - Added `Regwall` and wired public paginated feeds so logged-out users can read the first server-rendered page, then must sign up or sign in to load more articles.
  - The gate is disabled automatically when Neon Auth env is not configured.
  - Verification: `npx tsc --noEmit` passed; existing dev server returned `200` for `/`, `/topic/technology`, `/search?q=climate`, and `/ai-news`. The in-app browser click check could not run because the Browser plugin failed to initialize its local assets.
- Security report:
  - Added `SECURITY_REPORT.md` with a source-backed audit of admin auth, Neon user auth, cron auth, SSRF guard, destructive-operation safeguards, user data isolation, RSS/content safety, XSS/link handling, AI fallback behavior, local env var names, and confirmed gaps.
  - Verification commands included `npx tsc --noEmit`, route/source scans, and local unauthenticated HTTP checks against admin/user/AI endpoints.
- Security remediation plan:
  - Added `SECURITY_REMEDIATION_PLAN.md` with phased fixes, exact files, verification commands, acceptance criteria, and a recommended atomic commit scope.
- Security remediation implementation:
  - Added `isAdminAuthorized(request)` to `POST /api/ai/manager`.
  - Added `src/app/api/admin/ai/newsroom/activity/route.ts` with admin auth and updated `NewsroomClient` polling/refresh calls to `/api/admin/ai/newsroom/activity`.
  - Changed old `/api/ai/newsroom/activity` to require admin auth and return `410` after auth instead of exposing records publicly.
  - Added local `isAdminAuthorized(request)` defense-in-depth to `DELETE /api/admin/articles`.
  - Added global security headers in `next.config.ts`: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
  - Updated `SECURITY_REPORT.md` and `SECURITY_REMEDIATION_PLAN.md` with fixed statuses and remaining manual checks.
  - Local docs consulted before route/config edits:
    - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
    - `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`
  - Verification: `npx tsc --noEmit` passed; fresh dev server returned `200` for `/`; unauthenticated checks returned `/admin=307`, `/api/admin/ping=401`, `/api/admin/articles DELETE=401`, `/api/ai/batch POST=401`, `/api/ai/newsroom/process POST=401`, `/api/ai/manager POST=401`, old `/api/ai/newsroom/activity=401`, new `/api/admin/ai/newsroom/activity=401`, `/api/user/bookmarks=401`, and `/api/feed?scope=bookmarks=401`.
  - Header verification on `/`: CSP, `X-Frame-Options=DENY`, `X-Content-Type-Options=nosniff`, `Referrer-Policy=strict-origin-when-cross-origin`, and `Permissions-Policy` were present.
  - Authenticated smoke checks using local `ADMIN_SECRET`: `/api/admin/articles DELETE` without target returned `400`; `/api/admin/ai/newsroom/activity` and `/api/ai/manager` passed auth but returned `500` because Prisma could not reach the Neon host in `DATABASE_URL`.
  - Security gap update follow-up:
    - Added a fixed 100ms response delay to `POST /api/admin/auth` before configured failure and success responses to slow brute-force attempts.
    - Changed `POST /api/user/read` to return `401 { "error": "Unauthorized" }` when no Neon Auth user id is available, matching the other `/api/user/*` routes.
    - Appended the 2026-06-03 gap update to `SECURITY_REPORT.md`, covering batch auth, rate limiting, admin brute-force hardening, digest env names, RSS prompt-injection mitigation, search published filtering, user null guards, AutoSync bootstrap behavior, seed-sources auth, and newsroom process auth.
    - Appended matching fix entries and updated acceptance criteria to `SECURITY_REMEDIATION_PLAN.md`.
    - Items still deferred post-launch: rate limiting for public AI routes and replacing the single-admin secret scheme with role-based admin auth for multi-admin production.
  - RSS article detail pages:
    - Added `src/app/news/[id]/page.tsx` using the Next.js 16 promised `params` pattern from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`.
    - Published RSS articles now have internal detail pages with source badge, excerpt, optional AI summary/tags/agent analysis, related articles, and a CTA to the original publisher in a new tab.
    - `src/lib/articleLinks.ts` now returns internal links for both article types: RSS articles use `/news/:id`, AI reports use `/ai-news/:id`.
    - `src/components/NewsCard.tsx` now computes internal article hrefs directly and no longer opens RSS cards in a new tab; external navigation is reserved for the detail-page full-story CTA.
    - Verification: `npx tsc --noEmit` passed.
  - Internal article page AI enhancements:
    - Added `src/components/ArticleAiPanel.tsx` for `/news/[id]` with one consolidated AI surface for summary, mood/sentiment, tags, and article-specific chat.
    - Added `POST /api/ai/article-chat`, which loads only `published: true` articles, builds scoped context from article title/source/topic/description/summary/tags, calls `ollamaChat(MODELS.CHAT)`, and logs success/failure through `logAiAction()`.
    - `/news/[id]` now passes initial article AI fields to `ArticleAiPanel` and no longer renders separate static summary/tag sections.
    - Article chat keeps local UI history capped to the latest 12 messages and shows the existing user-friendly AI unavailable fallback on failure.
    - Verification: `npx tsc --noEmit` passed.
  - Internal article AI UX polish:
    - Reworked `ArticleAiPanel` into a more presentable reader briefing with a headline, explanatory subcopy, status pills, richer summary card, mood/tag insight cards, suggested chat prompts, and styled chat bubbles.
    - Updated `POST /api/ai/summarize` to generate a 5-7 point reader briefing with context, why-it-matters, and what-to-watch guidance based only on the syndicated excerpt.
    - Added `force` support to `/api/ai/summarize` so the article page can replace short cached summaries when the user clicks `EXPAND BRIEFING`.
    - Verification: `npx tsc --noEmit` passed.
  - Reliable related article suggestions:
    - Added `src/lib/relatedArticles.ts` with deterministic scoring for related coverage using same topic, shared AI tags, title keyword overlap, same sentiment, recency, user region, source diversity, read history, and bookmarks.
    - `/news/[id]` and `/ai-news/[id]` now use `getRelatedArticles()` instead of the old latest-same-topic query.
    - Related sections are now titled `RELATED COVERAGE` and show compact reason labels such as `Shared tags: ...`, `Same topic`, `Similar headline`, or `Fresh update`.
    - Verification: `npx tsc --noEmit` passed.

2026-05-31:

- `npx tsc --noEmit` passed.
- `npm run lint` failed on existing lint debt listed in Known Issues.
- Security patch update:
  - Added `CRON_SECRET` to local `.env`.
  - Added local `.env` entries for `OLLAMA_HOST`, `OLLAMA_CHAT_MODEL`, and `OLLAMA_MANAGER_MODEL`.
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

2026-06-07:

- Admin AI post-implementation audit fixes:
  - Added `src/lib/adminJobSchemas.ts` with strict Zod validation for `newsroom_cycle`, `rag_reindex`, `ai_batch`, and `digest_generate`; `/api/admin/ai/jobs` validates params server-side before creating jobs.
  - Added root `zod` dependency declaration and kept the lockfile consistent with the already-installed local package.
  - Added `progress` and `phase` to `AdminAiJob`, plus `status`, `type/status`, and notification status/createdAt indexes through migration `20260607152035_add_job_progress_phase`.
  - Prisma again dropped the manual RAG HNSW vector index during migration, so `20260607152100_restore_article_embedding_hnsw_idx` restores it.
  - Added `/api/admin/notifications/read` and tightened `/api/admin/notifications` to return the last 20 rows, count unread by `status`, and fire-and-forget delete read notifications older than 7 days.
  - `/api/admin/ai/jobs/run-next` now accepts admin auth or `CRON_SECRET` bearer auth, resets stale running jobs older than 120 seconds, deletes completed/failed jobs older than 7 days, and deletes manager chat messages older than 30 days.
  - Admin notification polling now redirects to `/admin/login?next=/admin` on `401`, uses recursive timeout polling with backoff from 5s to 30s, and only calls `run-next` when queued/running jobs exist.
  - AI Manager chat history loads only the latest 50 messages; job-message polling uses `/api/admin/ai/manager/messages?after=...` and appends job assistant messages without refreshing.
  - AI Manager action cards now have dedicated client state: cleared on new user message, retained after stream end, and cleared after a job is successfully created; `409` duplicate job responses show “This task is already running...”.
  - Manager route now saves user and assistant messages server-side, sends only the last 10 messages to Ollama, includes explicit action-card/task-execution prompt rules, parses `[ACTION: ...]` markers into action-card SSE events, and strips markers from displayed/persisted text.
  - `newsroom_cycle` now runs as resumable phases: `scout`, `fact_check`, and `spin_doctor`; partial phases requeue the job and update `progress`/`phase`, allowing jobs over 60 seconds to continue across `run-next` invocations. Vercel Pro users can keep `maxDuration: 300`, but Hobby deployments still rely on phase splitting and cron/admin polling recovery.
  - Job failure messages now map common errors to helpful admin-facing text for Ollama down, missing model, and timeout/abort cases.
  - Verification: unauthenticated jobs/notifications/run-next/manager-messages returned `401`; invalid params returned `400`; duplicate newsroom job returned first `200`, second `409`; digest job completed and `/api/admin/ai/manager/messages?after=...` returned “Today's digest has been generated. View it at /digest.”; cleanup count for completed/failed jobs older than 7 days was `0`; active admin AI job count was `0`; `npx tsc --noEmit` passed; `npm run build` passed.
- Admin AI follow-up hotfix:
  - Moved the admin notification bell into a sticky top admin header so it stays visible even when the sidebar is collapsed or scrolled.
  - Added an AI Manager “ACTIVE AI TASKS” strip with current queued/running jobs and a `CHECK / RESUME` button.
  - Newsroom scout jobs now emit progress chat/notification messages during scout generation and article review instead of only saying “started.”
  - Reduced the v1 newsroom review batch to 3 articles, made individual article-review errors non-fatal, and added an Ollama chat timeout so jobs do not loop forever on a hung agent call.
  - Added a duplicate active-job guard so clicking the same task again reuses the active job instead of launching another scout.
  - Marked the two previously looping `newsroom_cycle` jobs as failed with explicit manager chat and notification messages; active admin AI job count verified as 0.
  - Verification: `npx tsc --noEmit` passed.
- Admin AI task follow-up system:
  - Added DB-backed `AdminAiJob`, `AdminNotification`, and `ManagerChatMessage` models for queued/running/completed/failed admin AI work, in-app notifications, and persistent AI Manager chat history.
  - Added `src/lib/adminAiJobs.ts` with explicit job creation and execution for `newsroom_cycle`, `rag_reindex`, `ai_batch`, and `digest_generate`; job transitions now write both notifications and manager chat messages.
  - Added `/api/admin/ai/jobs`, `/api/admin/ai/jobs/run-next`, `/api/admin/notifications`, and `/api/admin/ai/manager/messages`, all protected by `isAdminAuthorized`.
  - Updated `/api/ai/manager` to keep SSE streaming but return structured `action_card` events; the system prompt now forbids “I started” / “I will notify you” claims unless a real clicked job exists.
  - Updated AI Manager UI to load persisted chat, render action cards, queue jobs from card clicks, and poll persisted manager messages so completion/failure messages appear after the original chat stream ends.
  - Wrapped the admin shell in `AdminNotificationProvider` and added a sidebar notification bell/dropdown polling `/api/admin/notifications` every 5 seconds; queued/running notifications trigger `run-next` recovery while admin is open.
  - Consulted local Next docs at `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` before using `after()` in the jobs API.
  - Prisma migration `20260607052740_add_admin_ai_jobs_notifications` was created/applied; it dropped the manually managed RAG HNSW index, so corrective migration `20260607052900_restore_article_embedding_hnsw_idx` recreates `ArticleEmbedding_embedding_hnsw_idx`.
  - Verification: `npx prisma migrate dev --name add-admin-ai-jobs-notifications` applied the admin models; `npx prisma migrate deploy` applied the corrective index migration; `npx prisma generate` passed after stopping the local Next dev server that held Prisma's DLL lock; `npx tsc --noEmit` passed.

2026-06-01:

- Newsroom Phase 2/3 upgrade:
  - Added `POST /api/admin/ai/reanalyse` to run `runFactChecker()` and `runSpinDoctor()` for a single draft and return updated analysis fields.
  - Reworked `NewsroomClient` into a three-column layout: activity terminal, filtered/sorted draft queue, and preview/agent roster panel.
  - Added per-draft re-analysis, richer draft cards, activity timestamps with `VIEW` jumps, a newsroom stats bar, topic filtering, newest/score sorting, a pulsing `● RUNNING...` / `▶ DEPLOY AGENTS` state, and publish toast links to `/ai-news/:id`.
  - Removed the unused draft-side `unpublishArticle()` client helper; unpublish remains available through `/api/admin/ai/unpublish` for a future published-articles view.
  - Phase 3 verification: source checks confirmed `topicFilter`, `sortBy`, `sortedFilteredDrafts`, topic filter buttons, `NEWEST`/`BY SCORE`, and `@keyframes pulse` are present; `npx tsc --noEmit` passed; `npm run lint` remains at the existing 9 errors and 5 warnings baseline.
  - Earlier verification: unauthenticated `POST /api/admin/ai/reanalyse` returned `401`; server logs showed `/admin/newsroom`, `/api/ai/newsroom/activity`, and `/api/admin/ai/drafts` returning `200`. Browser automation could not complete because the local browser runtime crashed with `spawn setup refresh`.
- Newsroom Phase 1 upgrade:
  - Added admin authorization to `POST /api/ai/newsroom/process`.
  - Scout-generated drafts now start with `aiProcessed: false` and no placeholder `factScore`/`biasAnalysis`, so the same full agentic cycle runs real fact-checking and bias analysis before marking them processed.
  - `runFullAgenticCycle()` now explicitly generates Scout drafts, then processes unprocessed articles ordered by newest fetched rows.
  - Added `DELETE /api/admin/ai/discard` for permanently deleting unpublished AI drafts only.
  - Newsroom preview now shows a red-outline `DISCARD DRAFT` action instead of the misleading draft `UNPUBLISH` button.
  - Deploy Agents refreshes activity and drafts immediately after completion, and the activity terminal auto-scrolls when entries change.
  - Verification: `npx tsc --noEmit` passed; unauthenticated `POST /api/ai/newsroom/process` returned `401`; unauthenticated `DELETE /api/admin/ai/discard` returned `401`; authenticated discard with a fake draft id returned `404`, proving auth passed without deleting real data.
- AI report routing fix:
  - Added `src/lib/articleLinks.ts` to route AI-generated articles to internal `/ai-news/:id` pages regardless of stale placeholder URLs stored in `NewsArticle.link`.
  - Added `src/app/ai-news/[id]/page.tsx` using the Next.js 16 promised `params` pattern from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`.
  - Updated home, topic, search, bookmarks, and AI-news article mappings to use `getArticleLink()`.
  - Updated `NewsCard` so internal article links open in-app instead of as external `_blank` links.
  - Updated Scout generation so future AI reports store `/ai-news/:id` as their link.
  - Verification: `npx tsc --noEmit` passed; browser check on `http://localhost:3000/ai-news` showed AI card anchors using `/ai-news/:id` with no external target, and `http://localhost:3000/ai-news/ai-india-1780290912624` rendered the report page with AI badge and fact score.
- Publishing pipeline patch:
  - Home page filters to `published: true`, preventing draft leaks.
  - AI drafts/publish routes moved under `/api/admin/ai/*` and independently check `isAdminAuthorized`.
  - Added `/api/admin/ai/unpublish`.
  - Newsroom client uses admin drafts/publish/unpublish paths and polls every 15 seconds with abort cleanup.
  - Topic pages validate slugs with `notFound()` and filter `published: true`; `/topic/all` now works.
  - NewsCard image fallback replaced `innerHTML` with safe `textContent` DOM construction.
  - AdminSidebar still has no `useEffect` block; active matching now handles nested admin paths without marking Dashboard active for every page.
- Verification:
  - `npx tsc --noEmit` passed.
  - Incognito `/api/admin/ai/drafts`, `/publish`, and `/unpublish` returned 401.
  - `/topic/all` and `/topic/technology` returned 200.
  - `/topic/fakeSlug` returned 404.
  - Temporary unpublished AI article was hidden from `/`, appeared in admin drafts, published with 200, disappeared from drafts, appeared on `/`, unpublished with 200, returned to drafts, then was deleted from the DB.
  - Browser check showed script-shaped `source` rendered as literal text and `window.__lp_xss` stayed false.
  - `/admin/newsroom` browser smoke showed heading and pending publication section with no console errors after a poll interval.
  - `npm run lint` still fails on older lint debt, but the AdminSidebar set-state-in-effect error is gone.
- AI feature completion patch:
  - `/api/ai/chat` now uses `MODELS.CHAT`; `/api/ai/manager` now uses `MODELS.MANAGER`.
  - Local `.env` now uses `OLLAMA_CHAT_MODEL` and `OLLAMA_MANAGER_MODEL`; old `OLLAMA_MODEL_CHAT` and `OLLAMA_MODEL_MANAGER` names are no longer used.
  - `/ai-news` passes `aiGenerated: true` into `NewsCard`, so published Scout articles show the AI badge.
  - `NewsroomClient` draft previews include `factScore` and `biasAnalysis` when present and show a short publish confirmation toast.
  - `NewsCard` has a `tags` button that calls `/api/ai/tag` and updates tag badges without a reload.
  - Batch `task="all"` selects articles missing sentiment score, tags, or summary.
  - Fact-check scores are clamped to `0..100`; unexpected sentiment values store as `neutral`.
  - `ChatAssistant` displays a typing indicator and sends only the last 20 prior messages plus the new user message.
  - Scout generation now includes the `India` topic when context articles exist.
  - Verification: `npx tsc --noEmit` passed; `npm run lint` still fails on older lint debt, now at 11 errors and 5 warnings.
- Personalization Phase 1 foundation:
  - `prisma/schema.prisma` datasource changed from SQLite to PostgreSQL and now reads `env("DATABASE_URL")`.
  - Added migrations `20260601043320_init_postgres` and `20260601043456_add_feed_indexes`.
  - Added feed-performance indexes for published/date, topic/published/date, and published/fetchedAt queries.
  - Normalized future RSS topics to lowercase in `src/lib/sources.ts` and `src/app/api/sync/route.ts`.
  - Normalized Scout topic generation to lowercase in `src/lib/agents.ts`.
  - Ran `/api/sync` against Neon via local dev server; it saved 155 RSS articles, and the database ended with 157 articles after background/dev activity.
  - Ran `UPDATE "NewsArticle" SET topic = LOWER(topic);`.
  - Distinct topics in PostgreSQL verified as `business`, `india`, `science`, `sports`, `technology`, `world`.
  - Verification: `npx prisma migrate status` reported database schema up to date; authenticated `/admin` loaded with Dashboard and Total Articles; `npx tsc --noEmit` passed.
- Auth/mobile testing note:
  - Neon Auth signup works when the upstream origin is `http://localhost:3000`.
  - The active ngrok origin `https://stephan-terpeneless-decrepitly.ngrok-free.dev` was rejected by Neon Auth with `403 INVALID_ORIGIN`.
  - `/signup` and `/login` now map Neon Auth failures into safer, specific user messages for invalid origin, auth unreachable, duplicate signup email, and generic credential failures; server actions also log sanitized auth error details.
  - `NewsCard` mobile action buttons use direct pointer/touch activation with duplicate synthetic-click suppression, and bookmark failures now show visible feedback such as "Sign in to save bookmarks."
  - Verification: direct Neon Auth endpoint checks returned `200` for localhost origin and `403 INVALID_ORIGIN` for the ngrok origin; `npx tsc --noEmit` passed.

## How To Keep This File Updated

After every edit:

1. Update the relevant section above with changed files, behavior, new APIs, new env vars, known issues fixed/added, and commands/tests run.
2. If the change touches Next.js behavior, mention which local Next docs were consulted.
3. Keep this file factual and concise. It is a map, not a changelog.

export type SourceHealthBadge =
  | "healthy"
  | "degraded"
  | "failing"
  | "paused"
  | "stale"
  | "unknown"

export type AdminSchedulerKey =
  | "rss.sync"
  | "ai.jobs.run-next"
  | "rag.reindex.missing"

export type PlannedAdminEndpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE"
  path: string
  purpose: string
  implemented: boolean
  dependsOn: string[]
}

export type PlannedSchedule = {
  key: AdminSchedulerKey
  label: string
  cadenceLabel: string
  runNowEndpoint: string
  persistenceRequiredFor: Array<"enable-disable" | "override-next-run">
}

export const SOURCE_HEALTH_BADGE_RULES: ReadonlyArray<{
  badge: SourceHealthBadge
  rule: string
}> = [
  { badge: "paused", rule: "Source is disabled." },
  {
    badge: "failing",
    rule: "Source last status is error and fail count is at least 3.",
  },
  {
    badge: "degraded",
    rule: "Source last status is error or fail count is greater than 0.",
  },
  {
    badge: "stale",
    rule: "Enabled source has no successful fetch in the configured stale window.",
  },
  {
    badge: "healthy",
    rule: "Enabled source has a recent successful fetch and no current failures.",
  },
  { badge: "unknown", rule: "Source has not been checked yet." },
]

export const PLANNED_ADMIN_SOURCE_SCHEDULER_ENDPOINTS: ReadonlyArray<PlannedAdminEndpoint> =
  [
    {
      method: "GET",
      path: "/api/admin/sources",
      purpose: "List RSS source records.",
      implemented: true,
      dependsOn: ["prisma.feedSource"],
    },
    {
      method: "POST",
      path: "/api/admin/sources",
      purpose: "Create an RSS source.",
      implemented: true,
      dependsOn: ["prisma.feedSource"],
    },
    {
      method: "PATCH",
      path: "/api/admin/sources",
      purpose: "Pause/resume or edit an RSS source.",
      implemented: true,
      dependsOn: ["prisma.feedSource"],
    },
    {
      method: "DELETE",
      path: "/api/admin/sources",
      purpose: "Delete an unused RSS source.",
      implemented: true,
      dependsOn: ["prisma.feedSource", "prisma.newsArticle"],
    },
    {
      method: "GET",
      path: "/api/admin/sources/health",
      purpose: "Return health badges, stale status, counts, and source summary.",
      implemented: false,
      dependsOn: ["prisma.feedSource", "prisma.newsArticle"],
    },
    {
      method: "POST",
      path: "/api/admin/sources/health",
      purpose: "Check one source or all sources without ingesting articles.",
      implemented: false,
      dependsOn: ["src/lib/fetchFeeds.ts"],
    },
    {
      method: "GET",
      path: "/api/admin/scheduler",
      purpose: "Return visible scheduler rows for the control panel.",
      implemented: false,
      dependsOn: ["src/lib/autoSync.ts", "AdminSchedule proposal"],
    },
    {
      method: "PATCH",
      path: "/api/admin/scheduler/:key",
      purpose: "Enable/disable a schedule or override its next run.",
      implemented: false,
      dependsOn: ["AdminSchedule proposal"],
    },
    {
      method: "POST",
      path: "/api/admin/scheduler/:key/run",
      purpose: "Run a schedule immediately through shared job helpers.",
      implemented: false,
      dependsOn: ["src/app/api/admin/sync/route.ts", "src/app/api/admin/ai/jobs/run-next/route.ts"],
    },
  ]

export const PLANNED_ADMIN_SCHEDULES: ReadonlyArray<PlannedSchedule> = [
  {
    key: "rss.sync",
    label: "RSS Sync",
    cadenceLabel: "Every 5 minutes in development auto-sync; production cadence TBD.",
    runNowEndpoint: "/api/admin/scheduler/rss.sync/run",
    persistenceRequiredFor: ["enable-disable", "override-next-run"],
  },
  {
    key: "ai.jobs.run-next",
    label: "AI Job Runner",
    cadenceLabel: "Runs due queued jobs when triggered by admin or cron.",
    runNowEndpoint: "/api/admin/scheduler/ai.jobs.run-next/run",
    persistenceRequiredFor: ["enable-disable", "override-next-run"],
  },
  {
    key: "rag.reindex.missing",
    label: "RAG Missing Article Reindex",
    cadenceLabel: "Suggested periodic maintenance schedule; exact cadence TBD.",
    runNowEndpoint: "/api/admin/scheduler/rag.reindex.missing/run",
    persistenceRequiredFor: ["enable-disable", "override-next-run"],
  },
]

import { notFound } from "next/navigation"
import DepartmentRoomClient from "@/components/admin/DepartmentRoomClient"
import AssignmentDeskModule from "@/components/admin/rooms/AssignmentDeskModule"
import CopyDeskModule from "@/components/admin/rooms/CopyDeskModule"
import DigestRoomModule from "@/components/admin/rooms/DigestRoomModule"
import FetchNewsRoomModule from "@/components/admin/rooms/FetchNewsRoomModule"
import OperationsRoomModule from "@/components/admin/rooms/OperationsRoomModule"
import PublishingDeskModule from "@/components/admin/rooms/PublishingDeskModule"
import ResearchLibraryModule from "@/components/admin/rooms/ResearchLibraryModule"
import ReportingRoomModule from "@/components/admin/rooms/ReportingRoomModule"
import VerificationRoomModule from "@/components/admin/rooms/VerificationRoomModule"
import {
  DEPARTMENTS,
  getDepartment,
  jobTypesForDepartment,
  type AdminDepartmentId,
} from "@/lib/adminDepartments"
import { prisma } from "@/lib/db"
import { getRagStatus } from "@/lib/rag"
import { queueDigestGeneration, queueDigestRegeneration } from "@/app/admin/ai-manager/digest/actions"
import { queueVerificationCycle, queueReanalyseDrafts, dismissAllWarnings } from "@/app/admin/ai-manager/verification/actions"
import { queueReindexMissing, queueReindexRecent, queueReindexAll, runTestQuery } from "@/app/admin/ai-manager/research/actions"
import { queueScoutCycle, queueGenerateDrafts } from "@/app/admin/ai-manager/reporting/actions"
import { queueNewsroomCycle, queueAiBatch, queueRagReindex, queueDigestGeneration as assignmentDigest } from "@/app/admin/ai-manager/assignment/actions"

export const dynamic = "force-dynamic"

type Metric = {
  label: string
  value: string | number
  tone?: "neutral" | "good" | "warn" | "bad"
}

type RoomAction = {
  jobType: "newsroom_cycle" | "rag_reindex" | "ai_batch" | "digest_generate"
  label: string
  params: Record<string, unknown>
  confirmLabel: string
}

type PublishingArticle = {
  id: string
  title: string
  description: string | null
  topic: string
  image: string | null
  source: string
  fetchedAt: Date
  pubDate: Date
  published: boolean
  factScore: number | null
  biasAnalysis: string | null
  summary: string | null
}

type ResearchTopicCoverageRow = {
  topic: string
  totalArticles: bigint | number
  indexedArticles: bigint | number
  oldestMissingAt: Date | null
}

type DigestArticle = {
  id: string
  title: string
  topic: string
  source: string
  pubDate: Date
  summary: string | null
  factScore: number | null
}

type CopyBacklogRow = {
  topic: string
  total: bigint | number
  missingSummary: bigint | number
  missingTags: bigint | number
  missingSentiment: bigint | number
  oldestArticleAt: Date | null
}

function toPublishingReport(article: PublishingArticle) {
  return {
    id: article.id,
    title: article.title,
    description: article.description,
    topic: article.topic,
    image: article.image,
    sourceName: article.source,
    fetchedAt: article.fetchedAt.toISOString(),
    pubDate: article.pubDate.toISOString(),
    published: article.published,
    factScore: article.factScore,
    biasAnalysis: article.biasAnalysis,
    summary: article.summary,
    publicUrl: `/ai-news/${article.id}`,
  }
}

function roomActions(department: AdminDepartmentId): RoomAction[] {
  if (department === "assignment") {
    return [
      { jobType: "newsroom_cycle", label: "Run newsroom cycle", params: {}, confirmLabel: "Preview newsroom" },
      { jobType: "ai_batch", label: "Run full AI batch", params: { task: "all", limit: 20 }, confirmLabel: "Preview full batch" },
      { jobType: "rag_reindex", label: "Reindex RAG", params: { mode: "missing", limit: 50 }, confirmLabel: "Preview RAG" },
      { jobType: "digest_generate", label: "Generate digest", params: { regen: true }, confirmLabel: "Preview digest" },
    ]
  }
  if (department === "reporting" || department === "verification") {
    return [
      { jobType: "newsroom_cycle", label: department === "reporting" ? "Run Scout cycle" : "Run verification cycle", params: {}, confirmLabel: "Preview cycle" },
    ]
  }
  if (department === "copy_desk") {
    return [
      { jobType: "ai_batch", label: "Run summaries", params: { task: "summarize", limit: 20 }, confirmLabel: "Preview summaries" },
      { jobType: "ai_batch", label: "Run tags", params: { task: "tag", limit: 30 }, confirmLabel: "Preview tags" },
      { jobType: "ai_batch", label: "Run sentiment", params: { task: "sentiment", limit: 30 }, confirmLabel: "Preview mood" },
      { jobType: "ai_batch", label: "Run full copy batch", params: { task: "all", limit: 20 }, confirmLabel: "Preview full copy" },
    ]
  }
  if (department === "fetch_news") {
    return []
  }
  if (department === "research") {
    return [
      { jobType: "rag_reindex", label: "Reindex missing", params: { mode: "missing", limit: 50 }, confirmLabel: "Preview missing" },
      { jobType: "rag_reindex", label: "Reindex recent", params: { mode: "recent", limit: 50 }, confirmLabel: "Preview recent" },
      { jobType: "rag_reindex", label: "Reindex all", params: { mode: "all" }, confirmLabel: "Preview all" },
    ]
  }
  if (department === "digest") {
    return [
      { jobType: "digest_generate", label: "Generate digest", params: { regen: false }, confirmLabel: "Preview digest" },
      { jobType: "digest_generate", label: "Regenerate digest", params: { regen: true }, confirmLabel: "Preview regen" },
    ]
  }
  if (department === "publishing") {
    return [
      { jobType: "newsroom_cycle", label: "Prepare newsroom drafts", params: {}, confirmLabel: "Preview drafts" },
    ]
  }

  return [
    { jobType: "ai_batch", label: "Run health AI batch", params: { task: "all", limit: 10 }, confirmLabel: "Preview batch" },
    { jobType: "rag_reindex", label: "Check RAG queue", params: { mode: "missing", limit: 20 }, confirmLabel: "Preview RAG" },
  ]
}

async function getRoomMetrics(department: AdminDepartmentId): Promise<Metric[]> {
  const jobTypes = jobTypesForDepartment(department)
  const [unreadEvents, escalations, activeJobs, failedJobs] = await Promise.all([
    prisma.adminDepartmentEvent.count({ where: { department, status: "unread" } }),
    prisma.adminDepartmentEvent.count({
      where: {
        department,
        needsEditorReview: true,
        status: { notIn: ["resolved", "archived"] },
      },
    }),
    prisma.adminAiJob.count({
      where: { type: { in: jobTypes }, status: { in: ["queued", "running"] } },
    }),
    prisma.adminAiJob.count({
      where: { type: { in: jobTypes }, status: { in: ["failed", "dead_letter"] } },
    }),
  ])

  const base: Metric[] = [
    { label: "Unread Room Items", value: unreadEvents, tone: unreadEvents > 0 ? "warn" : "good" },
    { label: "Main Editor Inbox", value: escalations, tone: escalations > 0 ? "warn" : "neutral" },
    { label: "Active Jobs", value: activeJobs, tone: activeJobs > 0 ? "neutral" : "good" },
    { label: "Failures", value: failedJobs, tone: failedJobs > 0 ? "bad" : "good" },
  ]

  if (department === "copy_desk") {
    const [missingSummary, missingTags, missingSentiment] = await Promise.all([
      prisma.newsArticle.count({ where: { summary: null } }),
      prisma.newsArticle.count({ where: { aiTags: null } }),
      prisma.newsArticle.count({ where: { sentiment: null } }),
    ])
    return [
      ...base,
      { label: "Missing Summaries", value: missingSummary, tone: missingSummary > 0 ? "warn" : "good" },
      { label: "Missing Tags", value: missingTags, tone: missingTags > 0 ? "warn" : "good" },
      { label: "Missing Mood", value: missingSentiment, tone: missingSentiment > 0 ? "warn" : "good" },
    ]
  }

  if (department === "fetch_news") {
    const sources = await prisma.feedSource.findMany()
    const now = Date.now()
    const due = sources.filter(
      (source) =>
        source.enabled &&
        (!source.lastFetched ||
          now - source.lastFetched.getTime() >= source.fetchIntervalMinutes * 60 * 1000)
    ).length
    const failed = sources.filter(
      (source) => source.enabled && source.lastStatus === "error"
    ).length
    const disabled = sources.filter((source) => !source.enabled).length
    const neverFetched = sources.filter((source) => !source.lastFetched).length
    const latestFetched = sources
      .map((source) => source.lastFetched)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0]

    return [
      ...base,
      { label: "Enabled Sources", value: sources.length - disabled, tone: "good" },
      { label: "Due Now", value: due, tone: due > 0 ? "warn" : "good" },
      { label: "Failed Sources", value: failed, tone: failed > 0 ? "bad" : "good" },
      {
        label: "Last Fetch",
        value: latestFetched ? latestFetched.toLocaleString() : "Never",
        tone: latestFetched ? "neutral" : "warn",
      },
      { label: "Never Fetched", value: neverFetched, tone: neverFetched > 0 ? "warn" : "good" },
    ]
  }

  if (department === "research") {
    const rag = await getRagStatus()
    return [
      ...base,
      { label: "RAG Coverage", value: `${rag.coverage}%`, tone: rag.coverage < 80 ? "warn" : "good" },
      { label: "Indexed Articles", value: rag.embedded, tone: "neutral" },
      { label: "Chunks", value: rag.chunks, tone: "neutral" },
    ]
  }

  if (department === "reporting") {
    const [drafts, recentScout] = await Promise.all([
      prisma.newsArticle.count({ where: { aiGenerated: true, published: false } }),
      prisma.agentActivity.count({ where: { agent: "Scout" } }),
    ])
    return [
      ...base,
      { label: "Pending Drafts", value: drafts, tone: drafts > 0 ? "warn" : "good" },
      { label: "Scout Activity", value: recentScout, tone: "neutral" },
    ]
  }

  if (department === "verification") {
    const [lowFact, factActivities] = await Promise.all([
      prisma.newsArticle.count({ where: { factScore: { lt: 60 } } }),
      prisma.agentActivity.count({ where: { agent: { in: ["Fact-Checker", "Spin-Doctor"] } } }),
    ])
    return [
      ...base,
      { label: "Low Fact Score", value: lowFact, tone: lowFact > 0 ? "bad" : "good" },
      { label: "Verifier Activity", value: factActivities, tone: "neutral" },
    ]
  }

  if (department === "digest") {
    const digests = await prisma.dailyDigest.count()
    return [...base, { label: "Digest History", value: digests, tone: "neutral" }]
  }

  if (department === "publishing") {
    const [pending, published] = await Promise.all([
      prisma.newsArticle.count({ where: { aiGenerated: true, published: false } }),
      prisma.newsArticle.count({ where: { aiGenerated: true, published: true } }),
    ])
    return [
      ...base,
      { label: "Pending Drafts", value: pending, tone: pending > 0 ? "warn" : "good" },
      { label: "Published AI Reports", value: published, tone: "good" },
    ]
  }

  return base
}

async function getResearchLibraryData() {
  const rag = await getRagStatus()
  const [topicRows, indexEvents] = await Promise.all([
    prisma.$queryRaw<ResearchTopicCoverageRow[]>`
      SELECT
        a."topic",
        COUNT(a."id")::bigint AS "totalArticles",
        COUNT(DISTINCT e."articleId")::bigint AS "indexedArticles",
        MIN(CASE WHEN e."id" IS NULL THEN a."fetchedAt" ELSE NULL END) AS "oldestMissingAt"
      FROM "NewsArticle" a
      LEFT JOIN "ArticleEmbedding" e
        ON e."articleId" = a."id"
        AND e."embeddingModel" = ${rag.embeddingModel}
      WHERE a."published" = true
      GROUP BY a."topic"
      ORDER BY a."topic" ASC
    `,
    prisma.adminDepartmentEvent.findMany({
      where: { department: "research" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ])

  return {
    metrics: {
      totalArticles: rag.totalPublished,
      indexedArticles: rag.embedded,
      missingEmbeddings: Math.max(rag.totalPublished - rag.embedded, 0),
      lastIndexedAt: rag.lastIndexed,
      modelStatus: rag.lastError ? `Error: ${rag.lastError}` : rag.embeddingModel,
    },
    topicCoverageRows: topicRows.map((row) => {
      const total = Number(row.totalArticles)
      const indexed = Number(row.indexedArticles)
      const missing = Math.max(total - indexed, 0)
      return {
        topic: row.topic,
        totalArticles: total,
        indexedArticles: indexed,
        missingEmbeddings: missing,
        coveragePercent: total > 0 ? Math.round((indexed / total) * 100) : 0,
        oldestMissingAt: row.oldestMissingAt?.toISOString() ?? null,
        status: missing === 0 ? "healthy" : indexed > 0 ? "partial" : "stale",
      }
    }),
    indexEvents: indexEvents.map((event) => ({
      id: event.id,
      title: event.title,
      detail: event.body,
      topic: typeof event.metadata === "object" && event.metadata && "topic" in event.metadata
        ? String(event.metadata.topic)
        : null,
      status:
        event.severity === "success"
          ? "success"
          : event.severity === "error"
            ? "failure"
            : event.severity === "warning"
              ? "warning"
              : event.status === "unread"
                ? "running"
                : "success",
      createdAt: event.createdAt.toISOString(),
      affectedArticles:
        typeof event.metadata === "object" && event.metadata && "affectedArticles" in event.metadata
          ? Number(event.metadata.affectedArticles)
          : null,
    })),
  }
}

async function getDigestRoomData() {
  const today = new Date().toISOString().slice(0, 10)
  const [todayDigest, historyRows, includedArticles] = await Promise.all([
    prisma.dailyDigest.findUnique({ where: { date: today } }),
    prisma.dailyDigest.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.newsArticle.findMany({
      where: { published: true },
      orderBy: [{ factScore: "desc" }, { pubDate: "desc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        pubDate: true,
        summary: true,
        factScore: true,
      },
    }),
  ])

  const toDigestPreview = (content?: string | null) =>
    content ? content.slice(0, 360) : null
  const toDigestStatus = (digest: typeof todayDigest) =>
    digest ? "ready" : "empty"

  return {
    today: {
      id: todayDigest?.id ?? null,
      date: today,
      status: toDigestStatus(todayDigest),
      title: todayDigest ? `Daily digest for ${todayDigest.date}` : null,
      preview: toDigestPreview(todayDigest?.content),
      model: todayDigest?.model ?? null,
      generatedAt: todayDigest?.createdAt.toISOString() ?? null,
      updatedAt: todayDigest?.createdAt.toISOString() ?? null,
      includedCount: includedArticles.length,
      publicUrl: "/digest",
    },
    historyRows: historyRows.map((digest) => ({
      id: digest.id,
      date: digest.date,
      status: "ready",
      title: `Daily digest for ${digest.date}`,
      preview: toDigestPreview(digest.content),
      model: digest.model,
      generatedAt: digest.createdAt.toISOString(),
      includedCount: includedArticles.length,
      publicUrl: "/digest",
    })),
    includedArticles: includedArticles.map((article: DigestArticle) => ({
      id: article.id,
      title: article.title,
      topic: article.topic,
      sourceName: article.source,
      publishedAt: article.pubDate.toISOString(),
      score: article.factScore,
      reason: article.summary ?? "Recent high-signal public article.",
      publicUrl: `/news/${article.id}`,
    })),
    visibility: {
      isPublic: Boolean(todayDigest),
      publicUrl: "/digest",
      route: "/digest",
      lastPublishedAt: todayDigest?.createdAt.toISOString() ?? null,
      robotsAllowed: true,
      notes: todayDigest
        ? "The latest generated digest is available on the public digest page."
        : "No digest exists for today yet. Queue generation from this room.",
    },
  }
}

async function getCopyDeskData() {
  const [articles, topicRows] = await Promise.all([
    prisma.newsArticle.findMany({
      where: {
        published: true,
        OR: [{ summary: null }, { aiTags: null }, { sentiment: null }],
      },
      orderBy: { fetchedAt: "desc" },
      take: 60,
      select: {
        id: true,
        title: true,
        source: true,
        topic: true,
        fetchedAt: true,
        summary: true,
        aiTags: true,
        sentiment: true,
      },
    }),
    prisma.$queryRaw<CopyBacklogRow[]>`
      SELECT
        "topic",
        COUNT(*)::bigint AS "total",
        SUM(CASE WHEN "summary" IS NULL THEN 1 ELSE 0 END)::bigint AS "missingSummary",
        SUM(CASE WHEN "aiTags" IS NULL THEN 1 ELSE 0 END)::bigint AS "missingTags",
        SUM(CASE WHEN "sentiment" IS NULL THEN 1 ELSE 0 END)::bigint AS "missingSentiment",
        MIN("fetchedAt") AS "oldestArticleAt"
      FROM "NewsArticle"
      WHERE "published" = true
      GROUP BY "topic"
      ORDER BY "topic" ASC
    `,
  ])

  const missingSummary = articles.filter((article) => !article.summary).length
  const missingTags = articles.filter((article) => !article.aiTags).length
  const missingSentiment = articles.filter((article) => !article.sentiment).length

  return {
    articles: articles.map((article) => ({
      id: article.id,
      title: article.title,
      source: article.source,
      topic: article.topic,
      createdAt: article.fetchedAt.toISOString(),
      summary: article.summary,
      aiTags: article.aiTags,
      sentiment: article.sentiment,
      priority: (
        !article.summary && !article.aiTags && !article.sentiment
          ? "urgent"
          : !article.summary
            ? "high"
            : "normal"
      ) as "urgent" | "high" | "normal",
    })),
    topicBacklog: topicRows.map((row) => ({
      topic: row.topic,
      total: Number(row.total),
      missingSummary: Number(row.missingSummary),
      missingTags: Number(row.missingTags),
      missingSentiment: Number(row.missingSentiment),
      oldestArticleAt: row.oldestArticleAt?.toISOString() ?? null,
    })),
    actions: [
      {
        id: "copy-summary",
        label: "Run summary batch",
        description: "Create missing article summaries for the public feed and article pages.",
        queue: "summary" as const,
        count: missingSummary,
        tone: missingSummary > 0 ? "warn" as const : "good" as const,
        buttonLabel: "RUN SUMMARIES",
        params: { task: "summarize", limit: 30 },
      },
      {
        id: "copy-tags",
        label: "Run tag batch",
        description: "Fill missing AI tags so search, topics, and newsroom grouping stay useful.",
        queue: "tags" as const,
        count: missingTags,
        tone: missingTags > 0 ? "warn" as const : "good" as const,
        buttonLabel: "RUN TAGS",
        params: { task: "tag", limit: 30 },
      },
      {
        id: "copy-sentiment",
        label: "Run sentiment batch",
        description: "Score missing article mood so the public controls and filters have data.",
        queue: "sentiment" as const,
        count: missingSentiment,
        tone: missingSentiment > 0 ? "warn" as const : "good" as const,
        buttonLabel: "RUN MOOD",
        params: { task: "sentiment", limit: 30 },
      },
      {
        id: "copy-all",
        label: "Run full copy batch",
        description: "Process summaries, tags, and sentiment together for the highest backlog.",
        queue: "all" as const,
        count: new Set(articles.map((article) => article.id)).size,
        tone: articles.length > 0 ? "warn" as const : "good" as const,
        buttonLabel: "RUN FULL COPY",
        params: { task: "all", limit: 30 },
      },
    ],
  }
}

async function getOperationsRoomData(serializedJobs: Array<{
  id: string
  type: string
  status: string
  title: string
  error?: string | null
  phase?: string | null
  progress?: number | null
  retryCount?: number | null
  maxRetries?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  completedAt?: string | null
  scheduledFor?: string | null
}>) {
  const [unreadNotifications, rag, failedLogs] = await Promise.all([
    prisma.adminNotification.findMany({
      where: { status: "unread" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { title: true, body: true, severity: true },
    }),
    getRagStatus(),
    prisma.aiLog.count({ where: { success: false } }),
  ])

  const active = serializedJobs.filter((job) => job.status === "queued" || job.status === "running").length
  const failed = serializedJobs.filter((job) => job.status === "failed" || job.status === "dead_letter").length
  const cancelled = serializedJobs.filter((job) => job.status === "cancelled").length

  return {
    jobs: {
      active: serializedJobs.filter((job) => job.status === "queued" || job.status === "running"),
      failed: serializedJobs.filter((job) => job.status === "failed" || job.status === "dead_letter"),
      recent: serializedJobs.filter((job) => job.status === "cancelled" || job.status === "completed"),
    },
    notifications: unreadNotifications.map((item) => `${(item.severity ?? "info").toUpperCase()}: ${item.title} - ${item.body}`),
    systemHealth: [
      `Active jobs: ${active}`,
      `Failed/dead-letter jobs: ${failed}`,
      `Cancelled jobs: ${cancelled}`,
      `RAG coverage: ${rag.coverage}% (${rag.embedded}/${rag.totalPublished})`,
      `Embedding model: ${rag.embeddingModel}`,
      `Failed AI logs: ${failedLogs}`,
      rag.lastError ? `Latest RAG error: ${rag.lastError}` : "Latest RAG status: no recorded error",
    ],
  }
}

async function getAssignmentDeskData() {
  const [jobs, missingSummary, missingEmbeddings, pendingDrafts, todaysDigest] = await Promise.all([
    prisma.adminAiJob.findMany({
      where: { status: { in: ["queued", "running"] } },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
      take: 24,
    }),
    prisma.newsArticle.count({ where: { published: true, summary: null } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(a."id")::bigint AS count
      FROM "NewsArticle" a
      LEFT JOIN "ArticleEmbedding" e ON e."articleId" = a."id"
      WHERE a."published" = true
        AND e."id" IS NULL
    `,
    prisma.newsArticle.count({ where: { aiGenerated: true, published: false } }),
    prisma.dailyDigest.findUnique({ where: { date: new Date().toISOString().slice(0, 10) } }),
  ])

  const activeJobCount = jobs.filter((job) => job.status === "running").length
  const pendingJobCount = jobs.filter((job) => job.status === "queued").length

  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      type: job.type.replace(/_/g, "-"),
      status: job.scheduledFor && job.status === "queued" ? "scheduled" : job.status,
      scheduledFor: job.scheduledFor?.toISOString() ?? null,
      queuedAt: job.createdAt.toISOString(),
      priority: job.status === "running" ? "high" : "normal",
      owner: "AI Manager",
      detail: job.phase ?? job.error ?? null,
      estimatedItems:
        typeof job.params === "object" && job.params && "limit" in job.params
          ? Number(job.params.limit)
          : null,
    })),
    activeJobCount,
    pendingJobCount,
    suggestedActions: [
      {
        id: "missing-summaries",
        title: "Copy Desk has missing summaries",
        detail: "Run a summary batch before publishing or digest generation.",
        tone: missingSummary > 0 ? "warn" as const : "good" as const,
        count: missingSummary,
      },
      {
        id: "missing-rag",
        title: "Research index coverage gap",
        detail: "Queue a RAG reindex for published articles without embeddings.",
        tone: Number(missingEmbeddings[0]?.count ?? 0) > 0 ? "warn" as const : "good" as const,
        count: Number(missingEmbeddings[0]?.count ?? 0),
      },
      {
        id: "pending-drafts",
        title: "Publishing queue needs attention",
        detail: "Review pending AI newsroom drafts before public release.",
        tone: pendingDrafts > 0 ? "warn" as const : "good" as const,
        count: pendingDrafts,
      },
      {
        id: "today-digest",
        title: todaysDigest ? "Today digest exists" : "Today digest not generated",
        detail: todaysDigest ? "Digest Room has a generated briefing for today." : "Generate today's digest when copy and publishing queues are stable.",
        tone: todaysDigest ? "good" as const : "warn" as const,
        count: todaysDigest ? 1 : 0,
      },
    ],
  }
}

async function getReportingRoomData() {
  const [drafts, candidates, scoutActivity, activeJobs, topics] = await Promise.all([
    prisma.newsArticle.findMany({
      where: { aiGenerated: true },
      orderBy: { fetchedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        published: true,
        fetchedAt: true,
        summary: true,
        factScore: true,
      },
    }),
    prisma.newsArticle.findMany({
      where: { published: true },
      orderBy: { fetchedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        link: true,
        fetchedAt: true,
        summary: true,
        factScore: true,
      },
    }),
    prisma.agentActivity.findMany({
      where: { agent: "Scout" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.adminAiJob.count({
      where: { type: "newsroom_cycle", status: { in: ["queued", "running"] } },
    }),
    prisma.newsArticle.groupBy({
      by: ["topic"],
      where: { published: true },
      _count: { _all: true },
    }),
  ])

  const maxTopicCount = Math.max(...topics.map((topic) => topic._count._all), 1)

  return {
    scoutStatus: {
      status: activeJobs > 0 ? "running" : "idle",
      activeAgents: activeJobs,
      pendingSources: candidates.length,
      lastRunAt: scoutActivity[0]?.createdAt.toISOString() ?? null,
      model: "newsroom-cycle",
      note: activeJobs > 0 ? "Scout pipeline has queued or running work." : "Scout pipeline is idle.",
    },
    generatedDrafts: drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      topic: draft.topic,
      sourceName: draft.source,
      status: draft.published ? "ready" : "draft",
      createdAt: draft.fetchedAt.toISOString(),
      confidence: draft.factScore,
      summary: draft.summary,
    })),
    storyCandidates: candidates.map((article) => ({
      id: article.id,
      title: article.title,
      topic: article.topic,
      sourceName: article.source,
      sourceUrl: article.link,
      score: article.factScore ?? 50,
      reason: article.summary ?? "Recent article candidate for newsroom treatment.",
      discoveredAt: article.fetchedAt.toISOString(),
    })),
    coverageGaps: topics
      .filter((topic) => topic._count._all < maxTopicCount)
      .slice(0, 8)
      .map((topic) => ({
        id: `gap-${topic.topic}`,
        topic: topic.topic,
        severity: topic._count._all <= 1 ? "high" : "medium",
        missingSources: maxTopicCount - topic._count._all,
        detail: "Topic has lighter article coverage than the strongest current beat.",
        lastCoveredAt: null,
      })),
    recentActivity: scoutActivity.map((activity) => ({
      id: activity.id,
      title: `${activity.agent}: ${activity.action}`,
      detail: activity.content,
      status: activity.status === "completed" ? "success" : activity.status === "error" ? "failure" : "running",
      createdAt: activity.createdAt.toISOString(),
    })),
  }
}

async function getVerificationRoomData() {
  const [queueDrafts, lowScoreDrafts, failedJobs, suspiciousDrafts] = await Promise.all([
    prisma.newsArticle.findMany({
      where: {
        aiGenerated: true,
        published: false,
        OR: [{ factScore: null }, { biasAnalysis: null }],
      },
      orderBy: { fetchedAt: "desc" },
      take: 20,
    }),
    prisma.newsArticle.findMany({
      where: { aiGenerated: true, factScore: { lt: 70 } },
      orderBy: { factScore: "asc" },
      take: 16,
    }),
    prisma.adminAiJob.findMany({
      where: { type: "newsroom_cycle", status: { in: ["failed", "dead_letter"] } },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.newsArticle.findMany({
      where: {
        aiGenerated: true,
        published: false,
        OR: [{ description: null }, { summary: null }, { source: "" }],
      },
      orderBy: { fetchedAt: "desc" },
      take: 12,
    }),
  ])

  return {
    factCheckQueue: queueDrafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      topic: draft.topic,
      sourceName: draft.source,
      queuedAt: draft.fetchedAt.toISOString(),
      priority: draft.factScore === null ? "high" : "normal",
      status: "queued",
    })),
    lowFactScoreDrafts: lowScoreDrafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      factScore: draft.factScore,
      biasAnalysis: draft.biasAnalysis,
      sourceName: draft.source,
      updatedAt: draft.fetchedAt.toISOString(),
    })),
    failedVerificationJobs: failedJobs.map((job) => ({
      id: job.id,
      title: job.title,
      error: job.error,
      failedAt: job.updatedAt.toISOString(),
      attempts: job.retryCount,
    })),
    suspiciousDraftWarnings: suspiciousDrafts.map((draft) => ({
      id: `suspicious-${draft.id}`,
      title: draft.title,
      detail: "Draft is missing description, summary, or source information.",
      severity: !draft.summary ? "high" : "medium",
      draftId: draft.id,
    })),
    duplicateSourceWarnings: [],
  }
}

async function getFetchNewsRoomData() {
  const sources = await prisma.feedSource.findMany({
    orderBy: [{ topic: "asc" }, { priority: "desc" }, { name: "asc" }],
  })
  const now = Date.now()

  const enriched = sources.map((source) => {
    const isDue =
      source.enabled &&
      (!source.lastFetched ||
        now - source.lastFetched.getTime() >= source.fetchIntervalMinutes * 60 * 1000)

    return {
      id: source.id,
      name: source.name,
      topic: source.topic,
      url: source.url,
      enabled: source.enabled,
      priority: source.priority,
      fetchIntervalMinutes: source.fetchIntervalMinutes,
      lastFetched: source.lastFetched?.toISOString() ?? null,
      lastStatus: source.lastStatus,
      failCount: source.failCount,
      lastErrorAt: source.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: source.lastErrorMessage,
      isDue,
    }
  })

  const topicMap = new Map<
    string,
    { topic: string; total: number; enabled: number; due: number; failed: number; disabled: number }
  >()

  for (const source of enriched) {
    const row =
      topicMap.get(source.topic) ??
      { topic: source.topic, total: 0, enabled: 0, due: 0, failed: 0, disabled: 0 }
    row.total += 1
    if (source.enabled) row.enabled += 1
    else row.disabled += 1
    if (source.isDue) row.due += 1
    if (source.lastStatus === "error") row.failed += 1
    topicMap.set(source.topic, row)
  }

  const dueSources = enriched.filter((source) => source.isDue).slice(0, 12)
  const failedSources = enriched
    .filter((source) => source.lastStatus === "error" || !source.enabled)
    .sort((a, b) => b.failCount - a.failCount || a.name.localeCompare(b.name))
    .slice(0, 12)
  const recentSources = enriched
    .filter((source) => source.lastFetched)
    .sort((a, b) =>
      new Date(b.lastFetched ?? 0).getTime() - new Date(a.lastFetched ?? 0).getTime()
    )
    .slice(0, 12)

  const totals = {
    sources: enriched.length,
    enabled: enriched.filter((source) => source.enabled).length,
    disabled: enriched.filter((source) => !source.enabled).length,
    due: dueSources.length,
    failed: enriched.filter((source) => source.enabled && source.lastStatus === "error").length,
    neverFetched: enriched.filter((source) => !source.lastFetched).length,
  }

  const recommendations = [
    totals.due > 0
      ? `Run sync now: ${totals.due} enabled sources are due.`
      : "No manual sync needed yet; all enabled sources are inside their fetch interval.",
    totals.failed > 0
      ? `Review ${totals.failed} enabled failed sources before the next newsroom cycle.`
      : "No enabled source is currently marked failed.",
    totals.neverFetched > 0
      ? `${totals.neverFetched} sources have never fetched; keep an eye on the next sync result.`
      : "All enabled sources have fetched at least once.",
    totals.disabled > 0
      ? `${totals.disabled} disabled sources are parked for cleanup or replacement.`
      : "No disabled sources are waiting for cleanup.",
  ]

  return {
    totals,
    autoSync: {
      appIntervalLabel: "Every 5 minutes while app auto-sync is running",
      sourceIntervalLabel: "Per source, usually 30 minutes",
      note: "Auto-sync skips sources until their fetch interval expires. Manual sync uses the same due-source rules.",
    },
    topicRows: Array.from(topicMap.values()).sort((a, b) => a.topic.localeCompare(b.topic)),
    dueSources,
    failedSources,
    recentSources,
    recommendations,
  }
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ department: string }>
}) {
  const { department: slug } = await params
  const department = getDepartment(slug)
  if (!department) notFound()

  const jobTypes = jobTypesForDepartment(department.id)
  const [
    metrics,
    events,
    jobs,
    notifications,
    pendingDrafts,
    publishedReports,
    researchData,
    digestData,
    copyData,
    assignmentData,
    reportingData,
    verificationData,
    fetchNewsData,
  ] = await Promise.all([
    getRoomMetrics(department.id),
    prisma.adminDepartmentEvent.findMany({
      where: { department: department.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        job: { select: { id: true, type: true, status: true, title: true } },
      },
    }),
    prisma.adminAiJob.findMany({
      where: { type: { in: jobTypes } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.adminDepartmentEvent.findMany({
      where: {
        department: department.id,
        OR: [{ status: "unread" }, { needsEditorReview: true }],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    department.id === "publishing"
      ? prisma.newsArticle.findMany({
          where: { aiGenerated: true, published: false },
          orderBy: { fetchedAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            description: true,
            topic: true,
            image: true,
            source: true,
            fetchedAt: true,
            pubDate: true,
            published: true,
            factScore: true,
            biasAnalysis: true,
            summary: true,
          },
        })
      : Promise.resolve([]),
    department.id === "publishing"
      ? prisma.newsArticle.findMany({
          where: { aiGenerated: true, published: true },
          orderBy: { pubDate: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            description: true,
            topic: true,
            image: true,
            source: true,
            fetchedAt: true,
            pubDate: true,
            published: true,
            factScore: true,
            biasAnalysis: true,
            summary: true,
          },
        })
      : Promise.resolve([]),
    department.id === "research" ? getResearchLibraryData() : Promise.resolve(null),
    department.id === "digest" ? getDigestRoomData() : Promise.resolve(null),
    department.id === "copy_desk" ? getCopyDeskData() : Promise.resolve(null),
    department.id === "assignment" ? getAssignmentDeskData() : Promise.resolve(null),
    department.id === "reporting" ? getReportingRoomData() : Promise.resolve(null),
    department.id === "verification" ? getVerificationRoomData() : Promise.resolve(null),
    department.id === "fetch_news" ? getFetchNewsRoomData() : Promise.resolve(null),
  ])

  const serializedEvents = events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
    readAt: event.readAt?.toISOString() ?? null,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
  }))
  const serializedJobs = jobs.map((job) => ({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    scheduledFor: job.scheduledFor?.toISOString() ?? null,
  }))
  const serializedNotifications = notifications.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
    readAt: event.readAt?.toISOString() ?? null,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
  }))
  const operationsData =
    department.id === "operations" ? await getOperationsRoomData(serializedJobs) : null

  return (
    <>
      {department.id === "assignment" && assignmentData && (
        <AssignmentDeskModule
          jobs={assignmentData.jobs}
          suggestedActions={assignmentData.suggestedActions}
          activeJobCount={assignmentData.activeJobCount}
          pendingJobCount={assignmentData.pendingJobCount}
          onRunNewsroomCycle={queueNewsroomCycle}
          onRunAiBatch={queueAiBatch}
          onRunRagReindex={queueRagReindex}
          onGenerateDigest={assignmentDigest}
        />
      )}
      {department.id === "fetch_news" && fetchNewsData && (
        <FetchNewsRoomModule data={fetchNewsData} />
      )}
      {department.id === "reporting" && reportingData && (
        <ReportingRoomModule
          scoutStatus={reportingData.scoutStatus}
          generatedDrafts={reportingData.generatedDrafts}
          storyCandidates={reportingData.storyCandidates}
          coverageGaps={reportingData.coverageGaps}
          recentActivity={reportingData.recentActivity}
          onRunScout={queueScoutCycle}
          onGenerateDrafts={queueGenerateDrafts}
        />
      )}
      {department.id === "verification" && verificationData && (
        <VerificationRoomModule
          factCheckQueue={verificationData.factCheckQueue}
          lowFactScoreDrafts={verificationData.lowFactScoreDrafts}
          failedVerificationJobs={verificationData.failedVerificationJobs}
          suspiciousDraftWarnings={verificationData.suspiciousDraftWarnings}
          duplicateSourceWarnings={verificationData.duplicateSourceWarnings}
          onRunFactCheck={queueVerificationCycle}
          onReanalyse={queueReanalyseDrafts}
          onDismissWarnings={dismissAllWarnings}
        />
      )}
      {department.id === "copy_desk" && copyData && (
        <CopyDeskModule
          articles={copyData.articles}
          topicBacklog={copyData.topicBacklog}
          actions={copyData.actions}
        />
      )}
      {department.id === "publishing" && (
        <PublishingDeskModule
          pendingDrafts={pendingDrafts.map(toPublishingReport)}
          publishedReports={publishedReports.map(toPublishingReport)}
          publicBasePath="/ai-news"
        />
      )}
      {department.id === "research" && researchData && (
        <ResearchLibraryModule
          metrics={researchData.metrics}
          topicCoverageRows={researchData.topicCoverageRows}
          indexEvents={researchData.indexEvents}
          onReindexMissing={queueReindexMissing}
          onReindexRecent={queueReindexRecent}
          onReindexAll={queueReindexAll}
          onTestQuery={runTestQuery}
        />
      )}
      {department.id === "digest" && digestData && (
        <DigestRoomModule
          today={digestData.today}
          historyRows={digestData.historyRows}
          includedArticles={digestData.includedArticles}
          visibility={digestData.visibility}
          onGenerate={queueDigestGeneration}
          onRegenerate={queueDigestRegeneration}
        />
      )}
      {department.id === "operations" && operationsData && (
        <OperationsRoomModule
          jobs={operationsData.jobs}
          notifications={operationsData.notifications}
          systemHealth={operationsData.systemHealth}
        />
      )}
      <DepartmentRoomClient
        department={department}
        metrics={metrics}
        actions={roomActions(department.id)}
        initialEvents={serializedEvents}
        jobs={serializedJobs}
        notifications={serializedNotifications}
      />
    </>
  )
}

export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({
    department: department.route.split("/").at(-1),
  }))
}

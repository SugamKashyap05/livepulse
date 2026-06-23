/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { runFactChecker, runScoutGeneration, runSpinDoctor } from "@/lib/agents"
import {
  EMBEDDING_MODEL,
  MODELS,
  chat,
  generateDigest,
  structuredChat,
} from "@/lib/ollama"
import {
  clearEmbeddingModel,
  indexAllMissingArticles,
  indexAllPublishedArticles,
  indexArticle,
  indexMissingArticles,
  indexRecentArticles,
} from "@/lib/rag"
import {
  createDepartmentEvent,
  departmentForJobType,
  type AdminDepartmentId,
  type DepartmentEventMetadata,
  type DepartmentEventSeverity,
} from "@/lib/adminDepartments"
import { recordJobStateTransition } from "@/lib/jobTransitions"

export type AdminAiJobType =
  | "newsroom_cycle"
  | "rag_reindex"
  | "ai_batch"
  | "digest_generate"

export type AdminAiJobStatus = "queued" | "running" | "completed" | "failed"
  | "cancelled"
  | "dead_letter"

export type AdminAiActionCard = {
  jobType: AdminAiJobType
  label: string
  params: Record<string, unknown>
  confirmLabel: string
}

type CreateJobInput = {
  type: AdminAiJobType
  title: string
  params?: Record<string, unknown>
  maxRetries?: number
  scheduledFor?: Date | null
  parentJobId?: string | null
}

type BatchTask = "sentiment" | "tag" | "summarize" | "all"
type RagMode = "missing" | "recent" | "article" | "all"

const JOB_SCHEMA_VERSION = "1"
const DEFAULT_MAX_RETRIES = 3
const STALE_JOB_MS_BY_TYPE: Record<AdminAiJobType, number> = {
  newsroom_cycle: 10 * 60 * 1000,
  rag_reindex: 15 * 60 * 1000,
  ai_batch: 8 * 60 * 1000,
  digest_generate: 5 * 60 * 1000,
}

const VALID_JOB_TYPES = new Set<AdminAiJobType>([
  "newsroom_cycle",
  "rag_reindex",
  "ai_batch",
  "digest_generate",
])

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function parseLimit(value: unknown, fallback = 20, max = 100) {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value ?? fallback), 10)
  return Number.isNaN(parsed)
    ? fallback
    : Math.min(Math.max(1, parsed), max)
}

function parseBatchTask(value: unknown): BatchTask {
  return value === "tag" ||
    value === "summarize" ||
    value === "all" ||
    value === "sentiment"
    ? value
    : "all"
}

function parseRagMode(value: unknown): RagMode {
  return value === "recent" || value === "article" || value === "all"
    ? value
    : "missing"
}

function normalizeMaxRetries(value: unknown) {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value ?? ""), 10)
  if (Number.isNaN(parsed)) return DEFAULT_MAX_RETRIES
  return Math.min(Math.max(0, parsed), 10)
}

function getStaleCutoff(type: string) {
  const jobType = normalizeAdminAiJobType(type)
  const staleMs = jobType ? STALE_JOB_MS_BY_TYPE[jobType] : 5 * 60 * 1000
  return new Date(Date.now() - staleMs)
}

async function isJobCancelled(jobId: string) {
  const job = await prisma.adminAiJob.findUnique({
    where: { id: jobId },
    select: { status: true, cancelledAt: true },
  })
  return job?.status === "cancelled" || Boolean(job?.cancelledAt)
}

async function assertJobActive(jobId: string) {
  if (await isJobCancelled(jobId)) {
    throw new Error("Job cancelled")
  }
}

function getJobTitle(type: AdminAiJobType, params: Record<string, unknown>) {
  if (type === "newsroom_cycle") return "Run newsroom agents"
  if (type === "rag_reindex") {
    const mode = parseRagMode(params.mode)
    return mode === "all" ? "Reindex all RAG content" : `Reindex RAG (${mode})`
  }
  if (type === "ai_batch") {
    return `Run AI batch (${parseBatchTask(params.task)})`
  }
  return "Generate daily digest"
}

function getResultSummary(type: AdminAiJobType, result: unknown) {
  const data = asRecord(result)

  if (type === "newsroom_cycle") {
    return `Newsroom agents finished. ${Number(data.draftsPending ?? 0)} drafts are ready for review.`
  }
  if (type === "rag_reindex") {
    return `RAG reindex finished. ${JSON.stringify(result)}`
  }
  if (type === "ai_batch") {
    return `AI batch finished. Processed ${Number(data.processed ?? 0)} of ${Number(data.total ?? 0)} articles with ${Number(data.failed ?? 0)} failures.`
  }
  return "Today's digest has been generated. View it at /digest."
}

async function createNotification({
  type,
  title,
  body,
  jobId,
  department,
  severity,
  departmentEventId,
}: {
  type: string
  title: string
  body: string
  jobId?: string
  department?: AdminDepartmentId
  severity?: DepartmentEventSeverity
  departmentEventId?: string
}) {
  return prisma.adminNotification.create({
    data: {
      type,
      title,
      body,
      status: "unread",
      jobId,
      department,
      severity,
      departmentEventId,
    },
  })
}

async function recordDepartmentEvent({
  jobId,
  jobType,
  type,
  title,
  body,
  severity = "info",
  needsEditorReview = false,
  notify = false,
  metadata,
}: {
  jobId?: string
  jobType: string
  type: "activity" | "notification" | "warning" | "failure" | "result" | "editor_escalation"
  title: string
  body: string
  severity?: DepartmentEventSeverity
  needsEditorReview?: boolean
  notify?: boolean
  metadata?: DepartmentEventMetadata
}) {
  const department = departmentForJobType(jobType)
  return createDepartmentEvent({
    department,
    type,
    title,
    body,
    severity,
    needsEditorReview,
    jobId,
    sourceType: "job",
    metadata: {
      event: `job.${type}`,
      jobType,
      targetType: "job",
      ...metadata,
    },
    notify,
  })
}

async function createManagerMessage({
  role,
  content,
  jobId,
  metadata,
}: {
  role: "user" | "assistant"
  content: string
  jobId?: string
  metadata?: Record<string, unknown>
}) {
  return prisma.managerChatMessage.create({
    data: {
      role,
      content,
      jobId,
      metadata: metadata ? toJsonObject(metadata) : undefined,
    },
  })
}

function skipJobChatMessage() {
  return Promise.resolve(null)
}

async function recordJobProgress(
  jobId: string,
  content: string,
  metadata?: DepartmentEventMetadata
) {
  const job = await prisma.adminAiJob.findUnique({
    where: { id: jobId },
    select: { type: true, title: true },
  })

  await Promise.all([
    prisma.adminAiJob.update({
      where: { id: jobId },
      data: { updatedAt: new Date() },
    }),
    recordDepartmentEvent({
      jobId,
      jobType: job?.type ?? "unknown",
      type: "activity",
      title: job?.title ? `Activity: ${job.title}` : "AI task activity",
      body: content,
      severity: "info",
      metadata,
    }),
  ])
}

export function normalizeAdminAiJobType(value: unknown): AdminAiJobType | null {
  return typeof value === "string" && VALID_JOB_TYPES.has(value as AdminAiJobType)
    ? (value as AdminAiJobType)
    : null
}

export async function previewAdminAiJob(
  type: AdminAiJobType,
  params: Record<string, unknown> = {}
) {
  if (type === "newsroom_cycle") {
    const [drafts, unprocessed] = await Promise.all([
      prisma.newsArticle.count({
        where: { aiGenerated: true, published: false },
      }),
      prisma.newsArticle.count({ where: { aiProcessed: false } }),
    ])
    return {
      title: getJobTitle(type, params),
      affectedCount: Math.max(drafts, unprocessed),
      affectedLabel: "drafts/articles",
      estimate: "2-10 minutes, depending on model speed",
      affectedTopics: ["newsroom"],
      warnings: drafts > 0 ? [`${drafts} unpublished drafts already exist`] : [],
    }
  }

  if (type === "ai_batch") {
    const task = parseBatchTask(params.task)
    const limit = parseLimit(params.limit, 20, 50)
    const topic = typeof params.topic === "string" ? params.topic : null
    const where: Prisma.NewsArticleWhereInput = {
      ...(topic ? { topic } : {}),
      ...(task === "sentiment"
        ? { sentiment: null }
        : task === "tag"
          ? { aiTags: null }
          : task === "summarize"
            ? { summary: null }
            : {
                OR: [
                  { scored: false },
                  { aiTags: null },
                  { summary: null },
                ],
              }),
    }
    const [totalMatching, topics] = await Promise.all([
      prisma.newsArticle.count({ where }),
      prisma.newsArticle.groupBy({
        by: ["topic"],
        where,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 6,
      }),
    ])
    const affectedCount = Math.min(totalMatching, limit)
    return {
      title: getJobTitle(type, params),
      affectedCount,
      affectedLabel: "articles",
      estimate: affectedCount <= 10 ? "under 2 minutes" : "2-8 minutes",
      affectedTopics: topics.map((row) => row.topic),
      warnings:
        totalMatching > limit
          ? [`${totalMatching - limit} matching articles will remain queued for a later batch`]
          : [],
    }
  }

  if (type === "rag_reindex") {
    const mode = parseRagMode(params.mode)
    const limit = parseLimit(params.limit, 20, 100)
    const affectedCount =
      mode === "all"
        ? await prisma.newsArticle.count({ where: { published: true } })
        : mode === "recent"
          ? Math.min(
              await prisma.newsArticle.count({ where: { published: true } }),
              limit
            )
          : mode === "article"
            ? typeof params.articleId === "string"
              ? 1
              : 0
            : Number(
                (
                  await prisma.$queryRaw<{ count: bigint }[]>`
                    SELECT COUNT(*)::bigint AS count
                    FROM "NewsArticle" a
                    LEFT JOIN "ArticleEmbedding" e
                      ON e."articleId" = a."id"
                      AND e."embeddingModel" = ${EMBEDDING_MODEL}
                    WHERE a."published" = true
                      AND e."id" IS NULL
                  `
                )[0]?.count ?? 0
              )
    return {
      title: getJobTitle(type, params),
      affectedCount: mode === "missing" ? Math.min(affectedCount, limit) : affectedCount,
      affectedLabel: "articles",
      estimate: affectedCount <= 20 ? "under 3 minutes" : "5-20 minutes",
      affectedTopics: [mode],
      warnings: mode === "all" ? ["Full RAG reindex clears existing embeddings first"] : [],
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const existing = await prisma.dailyDigest.findUnique({ where: { date: today } })
  return {
    title: getJobTitle(type, params),
    affectedCount: 1,
    affectedLabel: "digest",
    estimate: "under 2 minutes",
    affectedTopics: ["digest"],
    warnings:
      existing && params.regen !== true
        ? ["Today's digest already exists; this job will reuse the cached digest"]
        : [],
  }
}

export function buildAdminAiActionCards(message: string): AdminAiActionCard[] {
  const text = message.toLowerCase()
  const cards: AdminAiActionCard[] = []
  const wantsF1 = /\bf1\b|formula\s*1|formula one|monaco/.test(text)
  const wantsSports = wantsF1 || text.includes("sport")

  if (
    wantsF1 ||
    wantsSports ||
    text.includes("scout") ||
    text.includes("agent") ||
    text.includes("latest news") ||
    text.includes("top stories")
  ) {
    cards.push({
      jobType: "newsroom_cycle",
      label: wantsSports ? "Run sports/newsroom scout" : "Run newsroom scout",
      params: {},
      confirmLabel: "Start agents",
    })
  }

  if (
    text.includes("rag") ||
    text.includes("reindex") ||
    text.includes("search") ||
    wantsF1 ||
    wantsSports
  ) {
    cards.push({
      jobType: "rag_reindex",
      label: wantsSports ? "Reindex recent sports context" : "Reindex recent RAG",
      params: { mode: "recent", limit: 30 },
      confirmLabel: "Start reindex",
    })
  }

  if (text.includes("sentiment")) {
    cards.push({
      jobType: "ai_batch",
      label: "Batch analyse sentiment",
      params: { task: "sentiment", limit: 20 },
      confirmLabel: "Start sentiment batch",
    })
  }

  if (text.includes("tag")) {
    cards.push({
      jobType: "ai_batch",
      label: "Batch generate tags",
      params: { task: "tag", limit: 20 },
      confirmLabel: "Start tag batch",
    })
  }

  if (text.includes("summar")) {
    cards.push({
      jobType: "ai_batch",
      label: wantsSports ? "Batch summarize sports" : "Batch summarize articles",
      params: {
        task: "summarize",
        limit: 20,
      },
      confirmLabel: "Start summary batch",
    })
  }

  if (text.includes("digest")) {
    cards.push({
      jobType: "digest_generate",
      label: "Generate daily digest",
      params: { regen: text.includes("regenerate") },
      confirmLabel: "Generate digest",
    })
  }

  if (cards.length === 0 && /\brun\b|\bstart\b|\bprocess\b|\bdo\b/.test(text)) {
    cards.push({
      jobType: "ai_batch",
      label: "Run full AI batch",
      params: { task: "all", limit: 20 },
      confirmLabel: "Start AI batch",
    })
  }

  return cards.slice(0, 4)
}

export async function createAdminAiJob(input: CreateJobInput) {
  const params = input.params ?? {}
  const title = input.title || getJobTitle(input.type, params)

  const existing = await prisma.adminAiJob.findFirst({
    where: {
      type: input.type,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  })
  if (existing) {
    await Promise.all([
      recordDepartmentEvent({
        jobId: existing.id,
        jobType: input.type,
        type: "notification",
        title: "AI task already active",
        body: existing.title,
        severity: "warning",
        notify: true,
        metadata: {
          event: "job.already_active",
          status: existing.status,
          jobType: input.type,
        },
      }),
      skipJobChatMessage(),
    ])
    return existing
  }

  const job = await prisma.adminAiJob.create({
    data: {
      type: input.type,
      status: "queued",
      title,
      params: toJsonObject(params),
      phase: input.type === "newsroom_cycle" ? "scout" : null,
      progress: 0,
      retryCount: 0,
      maxRetries: normalizeMaxRetries(input.maxRetries),
      schemaVersion: JOB_SCHEMA_VERSION,
      scheduledFor: input.scheduledFor ?? null,
      parentJobId: input.parentJobId ?? null,
    },
  })

  await Promise.all([
    recordJobStateTransition({
      jobId: job.id,
      fromStatus: null,
      toStatus: "queued",
      event: "job.created",
      actorType: "admin",
      metadata: {
        jobType: input.type,
        title,
        phase: job.phase,
        params,
      },
    }),
    recordDepartmentEvent({
      jobId: job.id,
      jobType: input.type,
      type: "notification",
      title: "AI task queued",
      body: title,
      severity: "info",
      notify: true,
      metadata: {
        event: "job.queued",
        status: "queued",
        jobType: input.type,
        phase: job.phase,
        params,
      },
    }),
    skipJobChatMessage(),
  ])

  return job
}

async function runNewsroomCycle(jobId: string) {
  const job = await prisma.adminAiJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error("Job not found")
  await assertJobActive(jobId)
  const phase = job.phase || "scout"

  if (phase === "scout") {
    await recordJobProgress(jobId, "Scout is generating newsroom drafts now.", {
      event: "job.phase_started",
      action: "scout_generation",
      phase: "scout",
      jobType: job.type,
    })
    await runScoutGeneration()
    await assertJobActive(jobId)
    const advanced = await prisma.adminAiJob.updateMany({
      where: { id: jobId, status: "running" },
      data: { status: "queued", phase: "fact_check", progress: 34 },
    })
    if (advanced.count === 0) {
      return { success: false, partial: true, stopped: true }
    }
    await recordJobStateTransition({
      jobId,
      fromStatus: "running",
      toStatus: "queued",
      event: "job.phase_advanced",
      metadata: {
        jobType: job.type,
        fromPhase: "scout",
        toPhase: "fact_check",
        progress: 34,
      },
    })
    await recordJobProgress(
      jobId,
      "Scout phase finished. Fact-checking will continue in the next job tick.",
      {
        event: "job.phase_completed",
        action: "scout_generation",
        phase: "scout",
        nextPhase: "fact_check",
        jobType: job.type,
      }
    )
    return { success: true, partial: true, phase: "fact_check", progress: 34 }
  }

  const unprocessed = await prisma.newsArticle.findMany({
    where: { aiProcessed: false },
    take: 3,
    orderBy: { fetchedAt: "desc" },
    select: { id: true, title: true },
  })

  let processed = 0
  let failed = 0

  if (phase === "fact_check") {
    await assertJobActive(jobId)
    await recordJobProgress(
      jobId,
      `Fact-checking ${unprocessed.length} drafts.`,
      {
        event: "job.phase_started",
        action: "fact_check",
        phase: "fact_check",
        jobType: job.type,
        total: unprocessed.length,
      }
    )

    for (const article of unprocessed) {
      await assertJobActive(jobId)
      await recordJobProgress(
        jobId,
        `Fact-checking: ${article.title.slice(0, 90)}`,
        {
          event: "job.article_started",
          action: "fact_check",
          targetType: "article",
          articleId: article.id,
          phase: "fact_check",
          jobType: job.type,
        }
      )
      try {
        await runFactChecker(article.id)
        processed++
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : "Unknown error"
        await recordJobProgress(
          jobId,
          `Fact-check skipped one draft after an error: ${message.slice(0, 120)}`,
          {
            event: "job.article_failed",
            action: "fact_check",
            targetType: "article",
            articleId: article.id,
            phase: "fact_check",
            jobType: job.type,
            error: message.slice(0, 300),
          }
        )
      }
    }

    const advanced = await prisma.adminAiJob.updateMany({
      where: { id: jobId, status: "running" },
      data: { status: "queued", phase: "spin_doctor", progress: 67 },
    })
    if (advanced.count === 0) {
      return { success: false, partial: true, stopped: true }
    }
    await recordJobStateTransition({
      jobId,
      fromStatus: "running",
      toStatus: "queued",
      event: "job.phase_advanced",
      metadata: {
        jobType: job.type,
        fromPhase: "fact_check",
        toPhase: "spin_doctor",
        progress: 67,
        processed,
        failed,
      },
    })
    await recordJobProgress(
      jobId,
      "Fact-check phase finished. Bias analysis will continue in the next job tick.",
      {
        event: "job.phase_completed",
        action: "fact_check",
        phase: "fact_check",
        nextPhase: "spin_doctor",
        jobType: job.type,
        processed,
        failed,
      }
    )
    return {
      success: true,
      partial: true,
      phase: "spin_doctor",
      progress: 67,
      processed,
      failed,
    }
  }

  if (phase === "spin_doctor") {
    await assertJobActive(jobId)
    await recordJobProgress(
      jobId,
      `Bias-checking ${unprocessed.length} drafts.`,
      {
        event: "job.phase_started",
        action: "spin_doctor",
        phase: "spin_doctor",
        jobType: job.type,
        total: unprocessed.length,
      }
    )

    for (const article of unprocessed) {
      await assertJobActive(jobId)
      await recordJobProgress(
        jobId,
        `Bias-checking: ${article.title.slice(0, 90)}`,
        {
          event: "job.article_started",
          action: "spin_doctor",
          targetType: "article",
          articleId: article.id,
          phase: "spin_doctor",
          jobType: job.type,
        }
      )
      try {
        await runSpinDoctor(article.id)
        await prisma.newsArticle.update({
          where: { id: article.id },
          data: { aiProcessed: true },
        })
        processed++
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : "Unknown error"
        await recordJobProgress(
          jobId,
          `Bias-check skipped one draft after an error: ${message.slice(0, 120)}`,
          {
            event: "job.article_failed",
            action: "spin_doctor",
            targetType: "article",
            articleId: article.id,
            phase: "spin_doctor",
            jobType: job.type,
            error: message.slice(0, 300),
          }
        )
      }
    }
  }

  const draftsPending = await prisma.newsArticle.count({
    where: { aiGenerated: true, published: false },
  })
  return { success: true, draftsPending, processed, failed, phase: "completed" }
}

async function runRagReindex(params: Record<string, unknown>, jobId?: string) {
  const mode = parseRagMode(params.mode)
  const limit = parseLimit(params.limit, 20, 100)
  const indexAllMissing = params.all === true
  if (jobId) {
    await assertJobActive(jobId)
    await recordJobProgress(jobId, `RAG reindex started in ${mode} mode.`, {
      event: "job.phase_started",
      action: "rag_reindex",
      targetType: "rag_query",
      jobType: "rag_reindex",
      mode,
      limit,
      all: indexAllMissing,
    })
  }

  if (mode === "article") {
    const articleId = typeof params.articleId === "string" ? params.articleId : ""
    if (!articleId) throw new Error("articleId required for article reindex")
    if (jobId) {
      await recordJobProgress(jobId, `Reindexing article ${articleId}.`, {
        event: "job.article_started",
        action: "rag_reindex",
        targetType: "article",
        articleId,
        jobType: "rag_reindex",
      })
    }
    return indexArticle(articleId)
  }

  if (jobId && mode === "all") {
    await recordJobProgress(jobId, "Clearing existing embeddings before full RAG reindex.", {
      event: "job.phase_started",
      action: "rag_clear_embeddings",
      targetType: "rag_query",
      jobType: "rag_reindex",
      mode,
    })
  }

  if (mode === "recent") return indexRecentArticles(limit)
  if (mode === "all") {
    await clearEmbeddingModel(EMBEDDING_MODEL)
    return indexAllPublishedArticles()
  }
  if (indexAllMissing) return indexAllMissingArticles()
  return indexMissingArticles(limit)
}

async function runAiBatch(params: Record<string, unknown>, jobId?: string) {
  const task = parseBatchTask(params.task)
  const limit = parseLimit(params.limit, 20, 50)
  const topic = typeof params.topic === "string" ? params.topic : null
  if (jobId) await assertJobActive(jobId)

  const articles = await prisma.newsArticle.findMany({
    where: {
      ...(topic ? { topic } : {}),
      ...(task === "sentiment"
        ? { sentiment: null }
        : task === "tag"
          ? { aiTags: null }
          : task === "summarize"
            ? { summary: null }
            : {
                OR: [
                  { scored: false },
                  { aiTags: null },
                  { summary: null },
                ],
              }),
    },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      topic: true,
    },
  })

  let processed = 0
  let failed = 0

  for (const article of articles) {
    if (jobId) await assertJobActive(jobId)
    if (jobId) {
      await recordJobProgress(
        jobId,
        `Copy Desk processing: ${article.title.slice(0, 90)}`,
        {
          event: "job.article_started",
          action: `ai_batch.${task}`,
          targetType: "article",
          articleId: article.id,
          jobType: "ai_batch",
          topic: article.topic,
        }
      )
    }
    try {
      if (task === "sentiment" || task === "all") {
        const prompt = `Analyze the sentiment: ${article.title}. Return JSON: { "sentiment": "positive" | "neutral" | "negative", "confidence": 0.0-1.0 }`
        const start = Date.now()
        const res = await structuredChat<{ sentiment: string }>(
          prompt,
          MODELS.fast
        )
        const ms = Date.now() - start

        await prisma.newsArticle.update({
          where: { id: article.id },
          data: { sentiment: res.sentiment.toLowerCase(), scored: true },
        })

        await prisma.aiLog.create({
          data: {
            action: "sentiment_batch",
            model: MODELS.fast,
            prompt: article.title.slice(0, 50),
            ms,
          },
        })
      }

      if (task === "tag" || task === "all") {
        const prompt = `Tag this article with 3-5 keywords: ${article.title}. Return JSON: { "tags": ["tag1", "tag2", ...] }`
        const start = Date.now()
        const res = await structuredChat<{ tags: string[] }>(prompt, MODELS.fast)
        const ms = Date.now() - start

        await prisma.newsArticle.update({
          where: { id: article.id },
          data: { aiTags: JSON.stringify(res.tags), aiProcessed: true },
        })

        await prisma.aiLog.create({
          data: {
            action: "tag_batch",
            model: MODELS.fast,
            prompt: article.title.slice(0, 50),
            ms,
          },
        })
      }

      if (task === "summarize" || task === "all") {
        const prompt = `Summarize in 3 concise bullet points: ${article.title}.\n\n${article.description || ""}`
        const start = Date.now()
        const res = await chat(prompt, MODELS.fast)
        const ms = Date.now() - start

        await prisma.newsArticle.update({
          where: { id: article.id },
          data: { summary: res.text },
        })

        await prisma.aiLog.create({
          data: {
            action: "summary_batch",
            model: MODELS.fast,
            prompt: article.title.slice(0, 50),
            ms,
          },
        })
      }

      processed++
      if (jobId) {
        await recordJobProgress(
          jobId,
          `Copy Desk finished: ${article.title.slice(0, 90)}`,
          {
            event: "job.article_completed",
            action: `ai_batch.${task}`,
            targetType: "article",
            articleId: article.id,
            jobType: "ai_batch",
            topic: article.topic,
          }
        )
      }
    } catch (error) {
      console.error("[admin-ai-job] batch failed for", article.id, ":", error)
      failed++
      if (jobId) {
        const message = error instanceof Error ? error.message : "Unknown error"
        await recordJobProgress(
          jobId,
          `Copy Desk failed: ${article.title.slice(0, 90)}`,
          {
            event: "job.article_failed",
            action: `ai_batch.${task}`,
            targetType: "article",
            articleId: article.id,
            jobType: "ai_batch",
            topic: article.topic,
            error: message.slice(0, 300),
          }
        )
      }
    }

    // Pace requests to stay under NVIDIA NIM 40 RPM ceiling
    if (articles.indexOf(article) < articles.length - 1) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  return { success: true, processed, failed, total: articles.length, task, topic }
}

async function runDigestGenerate(params: Record<string, unknown>, jobId?: string) {
  const today = new Date().toISOString().slice(0, 10)
  const regenerate = params.regen === true
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  if (jobId) {
    await assertJobActive(jobId)
    await recordJobProgress(jobId, "Digest Room is preparing today's briefing.", {
      event: "job.phase_started",
      action: regenerate ? "digest_regenerate" : "digest_generate",
      targetType: "digest",
      jobType: "digest_generate",
      date: today,
      regenerate,
    })
  }

  if (regenerate) {
    await prisma.dailyDigest.deleteMany({ where: { date: today } })
  }

  const existing = await prisma.dailyDigest.findUnique({ where: { date: today } })
  if (existing) {
    return { success: true, cached: true, date: today, id: existing.id }
  }

  const articleSelect = {
    title: true,
    source: true,
    topic: true,
    description: true,
    sentiment: true,
  } satisfies Prisma.NewsArticleSelect

  let articles = await prisma.newsArticle.findMany({
    where: { published: true, fetchedAt: { gte: todayStart } },
    orderBy: { pubDate: "desc" },
    take: 30,
    select: articleSelect,
  })

  if (articles.length === 0) {
    articles = await prisma.newsArticle.findMany({
      where: { published: true },
      orderBy: { pubDate: "desc" },
      take: 30,
      select: articleSelect,
    })
  }

  const content = await generateDigest(articles)
  const digest = await prisma.dailyDigest.upsert({
    where: { date: today },
    update: { content, model: MODELS.smart },
    create: { date: today, content, model: MODELS.smart },
  })

  return { success: true, cached: false, date: today, id: digest.id }
}

export async function executeAdminAiJob(jobId: string) {
  const job = await prisma.adminAiJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error("Job not found")
  if (
    job.status === "completed" ||
    job.status === "cancelled" ||
    job.status === "dead_letter"
  ) {
    return job
  }
  if (job.scheduledFor && job.scheduledFor > new Date()) return job

  const staleCutoff = getStaleCutoff(job.type)
  if (job.status === "running" && job.updatedAt >= staleCutoff) return job

  const claimed = await prisma.adminAiJob.updateMany({
    where: {
      id: job.id,
      cancelledAt: null,
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      AND: {
        OR: [
          { status: "queued" },
          { status: "failed", retryCount: { lt: job.maxRetries } },
          { status: "running", updatedAt: { lt: staleCutoff } },
        ],
      },
    },
    data: {
      status: "running",
      startedAt: job.startedAt ?? new Date(),
      error: null,
      completedAt: null,
    },
  })
  if (claimed.count === 0) {
    return prisma.adminAiJob.findUnique({ where: { id: job.id } })
  }
  await recordJobStateTransition({
    jobId: job.id,
    fromStatus: job.status,
    toStatus: "running",
    event: job.status === "running" ? "job.recovered" : "job.claimed",
    metadata: {
      jobType: job.type,
      phase: job.phase,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
    },
  })

  if (job.status === "running") {
    await Promise.all([
      recordDepartmentEvent({
        jobId: job.id,
        jobType: job.type,
        type: "warning",
        title: "Recovering stalled task",
        body: job.title,
        severity: "warning",
        notify: true,
        metadata: {
          event: "job.recovered",
          status: job.status,
          jobType: job.type,
          phase: job.phase,
        },
      }),
      skipJobChatMessage(),
    ])
  }

  await Promise.all([
    recordDepartmentEvent({
      jobId: job.id,
      jobType: job.type,
      type: "activity",
      title: "AI task running",
      body: job.title,
      severity: "info",
      notify: true,
      metadata: {
        event: "job.running",
        status: "running",
        jobType: job.type,
        phase: job.phase,
      },
    }),
    skipJobChatMessage(),
  ])

  try {
    const params = asRecord(job.params)
    let result: unknown

    if (job.type === "newsroom_cycle") result = await runNewsroomCycle(job.id)
    else if (job.type === "rag_reindex") result = await runRagReindex(params, job.id)
    else if (job.type === "ai_batch") result = await runAiBatch(params, job.id)
    else if (job.type === "digest_generate") result = await runDigestGenerate(params, job.id)
    else throw new Error(`Unsupported job type: ${job.type}`)

    if (asRecord(result).partial === true) {
      return prisma.adminAiJob.findUnique({ where: { id: job.id } })
    }

    const body = getResultSummary(job.type as AdminAiJobType, result)

    const completed = await prisma.adminAiJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: "completed",
        result: result as Prisma.InputJsonValue,
        progress: 100,
        phase: job.type === "newsroom_cycle" ? "completed" : job.phase,
        completedAt: new Date(),
      },
    })
    if (completed.count === 0) {
      return prisma.adminAiJob.findUnique({ where: { id: job.id } })
    }
    await recordJobStateTransition({
      jobId: job.id,
      fromStatus: "running",
      toStatus: "completed",
      event: "job.completed",
      metadata: {
        jobType: job.type,
        phase: job.type === "newsroom_cycle" ? "completed" : job.phase,
        result: result as Prisma.InputJsonValue,
      },
    })
    const updated = await prisma.adminAiJob.findUnique({ where: { id: job.id } })

    await Promise.all([
      recordDepartmentEvent({
        jobId: job.id,
        jobType: job.type,
        type: "result",
        title: "AI task completed",
        body,
        severity: "success",
        notify: true,
        metadata: {
          event: "job.completed",
          status: "completed",
          jobType: job.type,
          phase: job.type === "newsroom_cycle" ? "completed" : job.phase,
          result: result as Prisma.InputJsonValue,
        },
      }),
      skipJobChatMessage(),
    ])

    return updated
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (message === "Job cancelled") {
      await prisma.adminAiJob.updateMany({
        where: { id: job.id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          completedAt: new Date(),
          error: "Cancelled by admin",
        },
      })
      await recordJobStateTransition({
        jobId: job.id,
        fromStatus: "running",
        toStatus: "cancelled",
        event: "job.cancelled",
        metadata: {
          jobType: job.type,
          phase: job.phase,
          error: "Cancelled by admin",
        },
      })
      await Promise.all([
        recordDepartmentEvent({
          jobId: job.id,
          jobType: job.type,
          type: "warning",
          title: "AI task cancelled",
          body: job.title,
          severity: "warning",
          notify: true,
          metadata: {
            event: "job.cancelled",
            status: "cancelled",
            jobType: job.type,
            phase: job.phase,
          },
        }),
        skipJobChatMessage(),
      ])
      return prisma.adminAiJob.findUnique({ where: { id: job.id } })
    }

    const lowerMessage = message.toLowerCase()
    const display =
      lowerMessage.includes("econnrefused")
        ? "Ollama is not running. Start Ollama and try again."
        : lowerMessage.includes("model not found")
          ? "The configured AI model is not installed. Run the matching ollama pull command, then try again."
          : lowerMessage.includes("timeout") ||
              lowerMessage.includes("aborted") ||
              lowerMessage.includes("aborterror")
            ? "The job took too long and was stopped. Try with a smaller batch."
            : `Job failed: ${message.slice(0, 200)}`
    const nextRetryCount = job.retryCount + 1
    const canRetry = nextRetryCount < job.maxRetries
    const nextStatus = canRetry ? "failed" : "dead_letter"
    const failed = await prisma.adminAiJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: nextStatus,
        error: message,
        retryCount: nextRetryCount,
        completedAt: new Date(),
      },
    })
    if (failed.count === 0) {
      return prisma.adminAiJob.findUnique({ where: { id: job.id } })
    }
    await recordJobStateTransition({
      jobId: job.id,
      fromStatus: "running",
      toStatus: nextStatus,
      event: canRetry ? "job.failed_retryable" : "job.dead_letter",
      metadata: {
        jobType: job.type,
        phase: job.phase,
        error: message.slice(0, 300),
        retryCount: nextRetryCount,
        maxRetries: job.maxRetries,
      },
    })
    const updated = await prisma.adminAiJob.findUnique({ where: { id: job.id } })

    await Promise.all([
      recordDepartmentEvent({
        jobId: job.id,
        jobType: job.type,
        type: "failure",
        title: canRetry ? "AI task failed" : "AI task permanently failed",
        body: canRetry
          ? `${job.title}: ${display} Retry ${nextRetryCount}/${job.maxRetries}.`
          : `${job.title}: ${display}`,
        severity: canRetry ? "warning" : "error",
        needsEditorReview: true,
        notify: true,
        metadata: {
          event: canRetry ? "job.failed_retryable" : "job.dead_letter",
          status: nextStatus,
          jobType: job.type,
          phase: job.phase,
          error: message.slice(0, 300),
          retryCount: nextRetryCount,
          maxRetries: job.maxRetries,
        },
      }),
      skipJobChatMessage(),
    ])

    return updated
  }
}

export async function runNextAdminAiJob() {
  const candidates = await prisma.adminAiJob.findMany({
    where: {
      cancelledAt: null,
      AND: [
        { OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
        {
          OR: [
            { status: "queued" },
            { status: "failed" },
            { status: "running" },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  })

  const job = candidates.find((candidate) => {
    if (candidate.status === "failed") {
      return candidate.retryCount < candidate.maxRetries
    }
    if (candidate.status === "running") {
      return candidate.updatedAt < getStaleCutoff(candidate.type)
    }
    return true
  })

  if (!job) return null
  return executeAdminAiJob(job.id)
}

export async function cancelAdminAiJob(jobId: string) {
  const now = new Date()
  const before = await prisma.adminAiJob.findUnique({
    where: { id: jobId },
    select: { status: true, type: true, phase: true, title: true },
  })
  const cancelled = await prisma.adminAiJob.updateMany({
    where: {
      id: jobId,
      status: { in: ["queued", "running", "failed"] },
    },
    data: {
      status: "cancelled",
      cancelledAt: now,
      completedAt: now,
      error: "Cancelled by admin",
    },
  })

  if (cancelled.count > 0) {
    const job = await prisma.adminAiJob.findUnique({ where: { id: jobId } })
    await recordJobStateTransition({
      jobId,
      fromStatus: before?.status ?? null,
      toStatus: "cancelled",
      event: "job.cancelled",
      actorType: "admin",
      metadata: {
        jobType: before?.type ?? job?.type,
        phase: before?.phase ?? job?.phase,
        title: before?.title ?? job?.title,
      },
    })
    await Promise.all([
      recordDepartmentEvent({
        jobId,
        jobType: job?.type ?? "unknown",
        type: "warning",
        title: "AI task cancelled",
        body: job?.title ?? "Admin AI task",
        severity: "warning",
        notify: true,
        metadata: {
          event: "job.cancelled",
          action: "cancel",
          status: "cancelled",
          jobType: job?.type,
          phase: job?.phase,
        },
      }),
      skipJobChatMessage(),
    ])
    return job
  }

  return prisma.adminAiJob.findUnique({ where: { id: jobId } })
}

export async function retryAdminAiJob(jobId: string) {
  const job = await prisma.adminAiJob.findUnique({ where: { id: jobId } })
  if (!job) return null
  if (!["failed", "dead_letter", "cancelled"].includes(job.status)) return job

  const updated = await prisma.adminAiJob.update({
    where: { id: jobId },
    data: {
      status: "queued",
      error: null,
      cancelledAt: null,
      completedAt: null,
      progress: job.status === "dead_letter" ? 0 : job.progress,
      retryCount: job.status === "dead_letter" ? 0 : job.retryCount,
    },
  })
  await recordJobStateTransition({
    jobId,
    fromStatus: job.status,
    toStatus: "queued",
    event: "job.retry_queued",
    actorType: "admin",
    metadata: {
      jobType: job.type,
      phase: job.phase,
      previousStatus: job.status,
      retryCount: updated.retryCount,
      maxRetries: updated.maxRetries,
    },
  })

  await Promise.all([
    recordDepartmentEvent({
      jobId,
      jobType: job.type,
      type: "notification",
      title: "AI task retry queued",
      body: job.title,
      severity: "info",
      notify: true,
      metadata: {
        event: "job.retry_queued",
        action: "retry",
        status: "queued",
        previousStatus: job.status,
        jobType: job.type,
        phase: job.phase,
        retryCount: updated.retryCount,
        maxRetries: updated.maxRetries,
      },
    }),
    skipJobChatMessage(),
  ])

  return updated
}

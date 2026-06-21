import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export const CONTEXT_EVENT_TYPES = [
  "impression",
  "click",
  "read",
  "dwell",
  "bookmark",
  "unbookmark",
  "like",
  "dislike",
  "hide",
  "share",
  "comment",
  "ai_action",
] as const

export type ContextEventType = (typeof CONTEXT_EVENT_TYPES)[number]

export type ContextEventInput = {
  articleId: string
  type: ContextEventType
  value?: number
  durationMs?: number
  visibleMs?: number
  scrollDepth?: number
  feedScope?: string
  feedPosition?: number
  surface?: string
  source?: string
  sessionId?: string
  pageViewId?: string
  context?: Prisma.InputJsonValue
  occurredAt?: Date
}

type WeightedMap = Record<string, number>

const EVENT_SCORE: Record<ContextEventType, number> = {
  impression: 0.12,
  click: 2,
  read: 2.5,
  dwell: 0,
  bookmark: 8,
  unbookmark: -4,
  like: 6,
  dislike: -7,
  hide: -10,
  share: 5,
  comment: 6,
  ai_action: 1,
}

export function isContextEventType(value: unknown): value is ContextEventType {
  return typeof value === "string" && CONTEXT_EVENT_TYPES.includes(value as ContextEventType)
}

export function scoreContextEvent(event: Pick<ContextEventInput, "type" | "durationMs" | "scrollDepth">) {
  const base = EVENT_SCORE[event.type]
  if (event.type !== "dwell") return base

  const durationScore = Math.min(Math.max(event.durationMs ?? 0, 0) / 30000, 4)
  const depthScore = Math.min(Math.max(event.scrollDepth ?? 0, 0), 1.2)
  return durationScore + depthScore
}

function clampNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, min), max)
    : undefined
}

export function normalizeContextEvent(input: unknown): ContextEventInput | null {
  if (!input || typeof input !== "object") return null
  const payload = input as Record<string, unknown>
  const articleId = typeof payload.articleId === "string" ? payload.articleId : null
  const type = payload.type
  if (!articleId || !isContextEventType(type)) return null

  const occurredAt =
    typeof payload.occurredAt === "string"
      ? new Date(payload.occurredAt)
      : undefined

  return {
    articleId,
    type,
    value: clampNumber(payload.value, -1000, 1000),
    durationMs: clampNumber(payload.durationMs, 0, 24 * 60 * 60 * 1000),
    visibleMs: clampNumber(payload.visibleMs, 0, 24 * 60 * 60 * 1000),
    scrollDepth: clampNumber(payload.scrollDepth, 0, 1),
    feedScope: typeof payload.feedScope === "string" ? payload.feedScope.slice(0, 80) : undefined,
    feedPosition: clampNumber(payload.feedPosition, 0, 10000),
    surface: typeof payload.surface === "string" ? payload.surface.slice(0, 80) : undefined,
    source: typeof payload.source === "string" ? payload.source.slice(0, 80) : undefined,
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId.slice(0, 120) : undefined,
    pageViewId: typeof payload.pageViewId === "string" ? payload.pageViewId.slice(0, 120) : undefined,
    context: isJsonObject(payload.context) ? payload.context : undefined,
    occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : undefined,
  }
}

function isJsonObject(value: unknown): value is Prisma.InputJsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function parseWeights(value: Prisma.JsonValue | null | undefined): WeightedMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const weights: WeightedMap = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) weights[key] = raw
  }
  return weights
}

function addWeight(map: WeightedMap, key: string | null | undefined, amount: number) {
  const normalized = key?.trim().toLowerCase()
  if (!normalized) return
  map[normalized] = Number(((map[normalized] ?? 0) + amount).toFixed(3))
}

function parseTags(aiTags: string | null | undefined) {
  try {
    const parsed = aiTags ? JSON.parse(aiTags) : []
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 8) : []
  } catch {
    return []
  }
}

export async function recordContextEvents({
  userId,
  anonymousId,
  events,
}: {
  userId?: string | null
  anonymousId?: string | null
  events: ContextEventInput[]
}) {
  const cleanEvents = events.slice(0, 40)
  if (cleanEvents.length === 0) return { accepted: 0 }

  const articleIds = Array.from(new Set(cleanEvents.map((event) => event.articleId)))
  const articles = await prisma.newsArticle.findMany({
    where: { id: { in: articleIds }, published: true },
    select: {
      id: true,
      topic: true,
      source: true,
      aiTags: true,
    },
  })
  const articleMap = new Map(articles.map((article) => [article.id, article]))
  const validEvents = cleanEvents.filter((event) => articleMap.has(event.articleId))

  if (validEvents.length === 0) return { accepted: 0 }

  await prisma.userArticleEvent.createMany({
    data: validEvents.map((event) => ({
      userId: userId ?? null,
      anonymousId: anonymousId ?? null,
      articleId: event.articleId,
      type: event.type,
      value: event.value,
      durationMs: event.durationMs,
      visibleMs: event.visibleMs,
      scrollDepth: event.scrollDepth,
      feedScope: event.feedScope,
      feedPosition: event.feedPosition,
      surface: event.surface,
      source: event.source,
      sessionId: event.sessionId,
      pageViewId: event.pageViewId,
      context: event.context,
      occurredAt: event.occurredAt ?? new Date(),
    })),
  })

  const targetId = userId ?? anonymousId
  if (targetId) {
    await updateUserContext({ userId: targetId, events: validEvents, articleMap })
  }

  return { accepted: validEvents.length }
}

async function updateUserContext({
  userId,
  events,
  articleMap,
}: {
  userId: string
  events: ContextEventInput[]
  articleMap: Map<string, { id: string; topic: string; source: string; aiTags: string | null }>
}) {
  await prisma.$transaction(async (tx) => {
    interface RawInterestProfile {
      topicWeights?: Prisma.JsonValue;
      sourceWeights?: Prisma.JsonValue;
      tagWeights?: Prisma.JsonValue;
      lastEventAt?: string | Date | null;
    }
    const existingProfiles = await tx.$queryRaw<RawInterestProfile[]>`SELECT * FROM "UserInterestProfile" WHERE "userId" = ${userId} FOR UPDATE`
    const existingProfile = existingProfiles[0]

    const topicWeights = parseWeights(existingProfile?.topicWeights)
    const sourceWeights = parseWeights(existingProfile?.sourceWeights)
    const tagWeights = parseWeights(existingProfile?.tagWeights)
    let lastEventAt = existingProfile?.lastEventAt ? new Date(existingProfile.lastEventAt as string | number | Date) : null

    for (const event of events) {
      const article = articleMap.get(event.articleId)
      if (!article) continue

      const scoreDelta = scoreContextEvent(event)
      const occurredAt = event.occurredAt ?? new Date()
      if (!lastEventAt || occurredAt > lastEventAt) lastEventAt = occurredAt

      addWeight(topicWeights, article.topic, scoreDelta)
      addWeight(sourceWeights, article.source, scoreDelta * 0.6)
      for (const tag of parseTags(article.aiTags)) addWeight(tagWeights, tag, scoreDelta * 0.45)

      await tx.userArticleContext.upsert({
        where: {
          userId_articleId: {
            userId,
            articleId: event.articleId,
          },
        },
        create: {
          userId,
          articleId: event.articleId,
          impressionCount: event.type === "impression" ? 1 : 0,
          clickCount: event.type === "click" ? 1 : 0,
          readCount: event.type === "read" ? 1 : 0,
          dwellMs: event.type === "dwell" ? event.durationMs ?? 0 : 0,
          maxScrollDepth: event.scrollDepth,
          bookmarked: event.type === "bookmark",
          liked: event.type === "like",
          disliked: event.type === "dislike",
          hidden: event.type === "hide",
          sharedCount: event.type === "share" ? 1 : 0,
          commentCount: event.type === "comment" ? 1 : 0,
          aiActionCount: event.type === "ai_action" ? 1 : 0,
          lastSeenAt: ["impression", "dwell"].includes(event.type) ? occurredAt : null,
          lastClickedAt: ["click", "read"].includes(event.type) ? occurredAt : null,
          lastEngagedAt: ["bookmark", "like", "share", "comment", "ai_action"].includes(event.type)
            ? occurredAt
            : null,
          score: scoreDelta,
        },
        update: {
          impressionCount: event.type === "impression" ? { increment: 1 } : undefined,
          clickCount: event.type === "click" ? { increment: 1 } : undefined,
          readCount: event.type === "read" ? { increment: 1 } : undefined,
          dwellMs: event.type === "dwell" ? { increment: event.durationMs ?? 0 } : undefined,
          maxScrollDepth: event.scrollDepth,
          bookmarked: event.type === "bookmark" ? true : event.type === "unbookmark" ? false : undefined,
          liked: event.type === "like" ? true : event.type === "dislike" ? false : undefined,
          disliked: event.type === "dislike" ? true : event.type === "like" ? false : undefined,
          hidden: event.type === "hide" ? true : undefined,
          sharedCount: event.type === "share" ? { increment: 1 } : undefined,
          commentCount: event.type === "comment" ? { increment: 1 } : undefined,
          aiActionCount: event.type === "ai_action" ? { increment: 1 } : undefined,
          lastSeenAt: ["impression", "dwell"].includes(event.type) ? occurredAt : undefined,
          lastClickedAt: ["click", "read"].includes(event.type) ? occurredAt : undefined,
          lastEngagedAt: ["bookmark", "like", "share", "comment", "ai_action"].includes(event.type)
            ? occurredAt
            : undefined,
          score: { increment: scoreDelta },
        },
      })
    }

    if (existingProfile) {
      await tx.userInterestProfile.update({
        where: { userId },
        data: {
          topicWeights,
          sourceWeights,
          tagWeights,
          lastEventAt,
        },
      })
    } else {
      await tx.userInterestProfile.create({
        data: {
          userId,
          topicWeights,
          sourceWeights,
          tagWeights,
          lastEventAt,
        },
      })
    }
  })
}

export async function rankArticlesForUser<T extends { id: string; topic: string; source: string; pubDate: Date }>(
  articles: T[],
  userId?: string | null,
  sessionId?: string | null
) {
  if (!userId || articles.length < 2) return articles

  const [contexts, interestProfile, userProfile, sessionEvents] = await Promise.all([
    prisma.userArticleContext.findMany({
      where: {
        userId,
        articleId: { in: articles.map((article) => article.id) },
      },
    }),
    prisma.userInterestProfile.findUnique({ where: { userId } }),
    prisma.userProfile.findUnique({
      where: { userId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: { personalizationEnabled: true } as any,
    }),
    sessionId ? prisma.userArticleEvent.findMany({
      where: {
        sessionId,
        occurredAt: { gte: new Date(Date.now() - 30 * 60000) },
      },
      select: { type: true, durationMs: true, scrollDepth: true, article: { select: { topic: true } } }
    }) : Promise.resolve([]),
  ])

  if ((userProfile as Record<string, unknown>)?.personalizationEnabled === false) return articles

  const contextMap = new Map(contexts.map((context) => [context.articleId, context]))
  const topicWeights = parseWeights(interestProfile?.topicWeights)
  const sourceWeights = parseWeights(interestProfile?.sourceWeights)
  
  const sessionWeights: WeightedMap = {}
  for (const event of (sessionEvents as Array<{ type: string; durationMs: number | null; scrollDepth: number | null; article: { topic: string } | null }>)) {
    if (!event.article) continue
    const scoreDelta = scoreContextEvent({ type: event.type as ContextEventType, durationMs: event.durationMs ?? undefined, scrollDepth: event.scrollDepth ?? undefined })
    addWeight(sessionWeights, event.article.topic, scoreDelta * 1.5) // Boost recent intent
  }

  // Identify cold-start
  const isColdStart = Object.keys(topicWeights).length === 0

  const scoredArticles = articles.map((article, index) => {
    const aContext = contextMap.get(article.id)
    // Add exploration factor (15% chance to apply random boost for cold start)
    const isExploration = isColdStart && (index % 7 === 0)
    const rawScore = feedScore(article, aContext, topicWeights, sourceWeights, sessionWeights, isExploration)
    return { article, score: rawScore, mmrScore: rawScore }
  })

  // Apply MMR (Maximal Marginal Relevance) Diversity
  const ranked: T[] = []
  const pickedTopics = new Map<string, number>()
  const pickedSources = new Map<string, number>()

  const pool = [...scoredArticles]
  
  while (pool.length > 0) {
    // Re-calculate MMR scores dynamically
    pool.forEach(item => {
      const topicCount = pickedTopics.get(item.article.topic.toLowerCase()) ?? 0
      const sourceCount = pickedSources.get(item.article.source.toLowerCase()) ?? 0
      
      // 0.8^k penalty for topic, 0.9^k penalty for source
      const topicPenalty = Math.pow(0.8, topicCount)
      const sourcePenalty = Math.pow(0.9, sourceCount)
      
      // We don't want negative scores to flip sign when multiplied by penalties, 
      // so we apply it primarily to the positive component, but simple multiplication works okay if bounded.
      // Better: adjust if score > 0, else keep it.
      item.mmrScore = item.score > 0 ? item.score * topicPenalty * sourcePenalty : item.score
    })

    // Sort to find the highest MMR score
    pool.sort((a, b) => b.mmrScore - a.mmrScore || b.article.pubDate.getTime() - a.article.pubDate.getTime())
    
    const best = pool.shift()!
    ranked.push(best.article)
    
    // Update diversity state
    const topic = best.article.topic.toLowerCase()
    const source = best.article.source.toLowerCase()
    pickedTopics.set(topic, (pickedTopics.get(topic) ?? 0) + 1)
    pickedSources.set(source, (pickedSources.get(source) ?? 0) + 1)
  }

  return ranked
}

function feedScore(
  article: { topic: string; source: string; pubDate: Date },
  context: Prisma.UserArticleContextGetPayload<object> | undefined,
  topicWeights: WeightedMap,
  sourceWeights: WeightedMap,
  sessionWeights: WeightedMap,
  isExploration: boolean
) {
  const hoursOld = Math.max((Date.now() - article.pubDate.getTime()) / 3600000, 0)
  // Exponential decay
  const freshness = 10 * Math.exp(-0.05 * hoursOld)
  
  const topicScore = (topicWeights[article.topic.toLowerCase()] ?? 0) + (sessionWeights[article.topic.toLowerCase()] ?? 0)
  const sourceScore = sourceWeights[article.source.toLowerCase()] ?? 0
  
  const behavior = context
    ? context.score * 0.4
      - context.readCount * 2
      - (context.hidden ? 25 : 0)
      - (context.disliked ? 10 : 0)
      + (context.bookmarked ? 3 : 0)
    : 0

  let score = freshness + topicScore * 0.25 + sourceScore * 0.12 + behavior
  
  if (isExploration) {
    score += 5 // Fixed boost to surface exploratory content
  }

  return score
}

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type Article = Prisma.NewsArticleGetPayload<object>

export type RelatedArticle = {
  article: Article
  reason: string
  score: number
}

export type RelatedArticleOptions = {
  articleId: string
  userId?: string | null
  limit?: number
}

type ScoredArticle = RelatedArticle & {
  sharedTags: string[]
  keywordOverlap: number
  sameTopic: boolean
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "amid",
  "and",
  "are",
  "because",
  "been",
  "before",
  "being",
  "between",
  "but",
  "can",
  "could",
  "for",
  "from",
  "has",
  "have",
  "into",
  "its",
  "new",
  "not",
  "over",
  "said",
  "says",
  "that",
  "the",
  "their",
  "this",
  "through",
  "under",
  "will",
  "with",
  "would",
])

function parseTags(aiTags: string | null) {
  try {
    const tags = aiTags ? JSON.parse(aiTags) : []
    return Array.isArray(tags)
      ? tags.map((tag) => String(tag).trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

function normalizeTag(tag: string) {
  return tag.toLowerCase()
}

function getKeywords(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
  )
}

function getSharedTags(sourceTags: string[], candidateTags: string[]) {
  const sourceSet = new Set(sourceTags.map(normalizeTag))
  return candidateTags.filter((tag) => sourceSet.has(normalizeTag(tag)))
}

function getReason(scored: ScoredArticle) {
  if (scored.sharedTags.length > 0) {
    return `Shared tags: ${scored.sharedTags.slice(0, 2).join(", ")}`
  }

  if (scored.sameTopic) return "Same topic"
  if (scored.keywordOverlap > 0) return "Similar headline"
  if (Date.now() - scored.article.pubDate.getTime() <= 72 * 60 * 60 * 1000) {
    return "Fresh update"
  }
  return "Related coverage"
}

function selectDiverseArticles(scored: ScoredArticle[], limit: number) {
  const selected: ScoredArticle[] = []
  const usedSources = new Set<string>()

  for (const item of scored) {
    if (selected.length >= limit) break
    if (usedSources.has(item.article.source)) continue
    selected.push(item)
    usedSources.add(item.article.source)
  }

  for (const item of scored) {
    if (selected.length >= limit) break
    if (selected.some((selectedItem) => selectedItem.article.id === item.article.id)) {
      continue
    }
    selected.push(item)
  }

  return selected
}

export async function getRelatedArticles({
  articleId,
  userId,
  limit = 4,
}: RelatedArticleOptions): Promise<RelatedArticle[]> {
  const source = await prisma.newsArticle.findFirst({
    where: { id: articleId, published: true },
  })

  if (!source) return []

  const sameTopicCandidates = await prisma.newsArticle.findMany({
    where: {
      id: { not: source.id },
      published: true,
      topic: source.topic,
    },
    orderBy: { pubDate: "desc" },
    take: 40,
  })

  const backfillCandidates = sameTopicCandidates.length >= limit
    ? []
    : await prisma.newsArticle.findMany({
        where: {
          id: { notIn: [source.id, ...sameTopicCandidates.map((item) => item.id)] },
          published: true,
        },
        orderBy: { pubDate: "desc" },
        take: 40 - sameTopicCandidates.length,
      })

  const candidates = [...sameTopicCandidates, ...backfillCandidates]
  if (candidates.length === 0) return []

  const candidateIds = candidates.map((candidate) => candidate.id)
  const sourceNames = Array.from(
    new Set([source.source, ...candidates.map((candidate) => candidate.source)])
  )

  const [profile, reads, bookmarks, feedSources] = await Promise.all([
    userId
      ? prisma.userProfile.findUnique({
          where: { userId },
          select: { region: true },
        })
      : null,
    userId
      ? prisma.userArticleRead.findMany({
          where: { userId, articleId: { in: candidateIds } },
          select: { articleId: true },
        })
      : [],
    userId
      ? prisma.userBookmark.findMany({
          where: { userId, articleId: { in: candidateIds } },
          select: { articleId: true },
        })
      : [],
    prisma.feedSource.findMany({
      where: { name: { in: sourceNames } },
      select: { name: true, region: true },
    }),
  ])

  const readSet = new Set(reads.map((read) => read.articleId))
  const bookmarkSet = new Set(bookmarks.map((bookmark) => bookmark.articleId))
  const sourceRegionByName = new Map(
    feedSources.map((feedSource) => [feedSource.name, feedSource.region])
  )
  const userRegion = profile?.region && profile.region !== "global"
    ? profile.region
    : null
  const sourceTags = parseTags(source.aiTags)
  const sourceKeywords = getKeywords(source.title)
  const now = Date.now()

  const scored = candidates
    .map((candidate): ScoredArticle => {
      const candidateTags = parseTags(candidate.aiTags)
      const sharedTags = getSharedTags(sourceTags, candidateTags)
      const candidateKeywords = getKeywords(candidate.title)
      const keywordOverlap = Array.from(sourceKeywords).filter((keyword) =>
        candidateKeywords.has(keyword)
      ).length
      const isRecent =
        now - candidate.pubDate.getTime() <= 72 * 60 * 60 * 1000
      const sourceRegion = sourceRegionByName.get(candidate.source)

      let score = 0
      const sameTopic = candidate.topic === source.topic

      if (sameTopic) score += 40
      score += Math.min(sharedTags.length * 25, 50)
      score += Math.min(keywordOverlap * 15, 45)
      if (source.sentiment && candidate.sentiment === source.sentiment) score += 10
      if (isRecent) score += 10
      if (userRegion && sourceRegion === userRegion) score += 8
      if (candidate.source === source.source) score -= 20
      if (readSet.has(candidate.id)) score -= 30
      if (bookmarkSet.has(candidate.id)) score += 10

      return {
        article: candidate,
        reason: candidate.topic,
        score,
        sharedTags,
        keywordOverlap,
        sameTopic,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.article.pubDate.getTime() - a.article.pubDate.getTime()
    })

  return selectDiverseArticles(scored, limit).map((item) => ({
    article: item.article,
    reason: getReason(item),
    score: item.score,
  }))
}

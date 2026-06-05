import type { Prisma } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"
import { getArticleLink } from "@/lib/articleLinks"
import { prisma } from "@/lib/db"
import type { NewsItem } from "@/types/news"

export const FEED_PAGE_SIZE = 24

export type FeedScope = "home" | "topic" | "search" | "tag" | "ai-news" | "bookmarks"

export type FeedPageOptions = {
  scope: FeedScope
  userId?: string | null
  topicSlug?: string | null
  sentiment?: string | null
  q?: string | null
  tag?: string | null
  cursor?: string | null
  limit?: number
}

export type FeedPage = {
  articles: NewsItem[]
  nextCursor: string | null
  hasMore: boolean
}

type CursorPayload = {
  value: string
  id: string
}

type ArticleWithFlags = Prisma.NewsArticleGetPayload<object> & {
  isRead?: boolean
  isBookmarked?: boolean
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) return null

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as CursorPayload

    if (!parsed.value || !parsed.id) return null
    return parsed
  } catch {
    return null
  }
}

function encodeArticleCursor(article: { pubDate: Date; id: string }) {
  return encodeCursor({ value: article.pubDate.toISOString(), id: article.id })
}

function encodeBookmarkCursor(bookmark: { createdAt: Date; id: string }) {
  return encodeCursor({ value: bookmark.createdAt.toISOString(), id: bookmark.id })
}

function articleCursorWhere(cursor?: string | null): Prisma.NewsArticleWhereInput {
  const decoded = decodeCursor(cursor)
  if (!decoded) return {}

  const value = new Date(decoded.value)
  if (Number.isNaN(value.getTime())) return {}

  return {
    OR: [
      { pubDate: { lt: value } },
      {
        AND: [
          { pubDate: { equals: value } },
          { id: { lt: decoded.id } },
        ],
      },
    ],
  }
}

function bookmarkCursorWhere(cursor?: string | null): Prisma.UserBookmarkWhereInput {
  const decoded = decodeCursor(cursor)
  if (!decoded) return {}

  const value = new Date(decoded.value)
  if (Number.isNaN(value.getTime())) return {}

  return {
    OR: [
      { createdAt: { lt: value } },
      {
        AND: [
          { createdAt: { equals: value } },
          { id: { lt: decoded.id } },
        ],
      },
    ],
  }
}

function normalizeSentiment(sentiment?: string | null) {
  return sentiment && ["positive", "neutral", "negative"].includes(sentiment)
    ? sentiment
    : null
}

function parseTags(aiTags: string | null) {
  try {
    const tags = aiTags ? JSON.parse(aiTags) : []
    return Array.isArray(tags) ? tags.map(String) : []
  } catch {
    return []
  }
}

function formatArticle(article: ArticleWithFlags): NewsItem {
  return {
    id: article.id,
    title: article.title,
    description: article.description || "",
    link: getArticleLink(article),
    pubDate: formatDistanceToNow(new Date(article.pubDate), { addSuffix: true }),
    source: article.source,
    topic: article.topic,
    image: article.image || undefined,
    summary: article.summary || undefined,
    sentiment: article.sentiment || undefined,
    aiTags: article.aiTags || undefined,
    aiGenerated: article.aiGenerated,
    isRead: article.isRead ?? false,
    isBookmarked: article.isBookmarked ?? false,
  }
}

async function getFollowedTopics(userId?: string | null) {
  if (!userId) return []

  const follows = await prisma.userTopicFollow.findMany({
    where: { userId },
    select: { topicSlug: true },
  })
  return follows.map((follow) => follow.topicSlug)
}

async function markUserState(
  articles: Prisma.NewsArticleGetPayload<object>[],
  userId?: string | null
): Promise<ArticleWithFlags[]> {
  if (!userId || articles.length === 0) {
    return articles.map((article) => ({
      ...article,
      isRead: false,
      isBookmarked: false,
    }))
  }

  const articleIds = articles.map((article) => article.id)
  const [reads, bookmarks] = await Promise.all([
    prisma.userArticleRead.findMany({
      where: { userId, articleId: { in: articleIds } },
      select: { articleId: true },
    }),
    prisma.userBookmark.findMany({
      where: { userId, articleId: { in: articleIds } },
      select: { articleId: true },
    }),
  ])
  const readSet = new Set(reads.map((read) => read.articleId))
  const bookmarkSet = new Set(bookmarks.map((bookmark) => bookmark.articleId))

  return articles.map((article) => ({
    ...article,
    isRead: readSet.has(article.id),
    isBookmarked: bookmarkSet.has(article.id),
  }))
}

async function buildArticleWhere(options: FeedPageOptions) {
  const sentiment = normalizeSentiment(options.sentiment)
  const cursorWhere = articleCursorWhere(options.cursor)
  const where: Prisma.NewsArticleWhereInput = {
    published: true,
  }
  const andFilters: Prisma.NewsArticleWhereInput[] = []

  if (Object.keys(cursorWhere).length > 0) andFilters.push(cursorWhere)

  if (options.scope === "ai-news") {
    where.aiGenerated = true
  }

  if (options.scope === "topic" && options.topicSlug && options.topicSlug !== "all") {
    where.topic = options.topicSlug
  }

  if (options.scope === "home") {
    const followedTopics = await getFollowedTopics(options.userId)
    if (followedTopics.length > 0) where.topic = { in: followedTopics }
  }

  if (options.scope === "search") {
    const q = options.q?.trim()
    if (!q || q.length < 2) return null

    andFilters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { source: { contains: q, mode: "insensitive" } },
        { topic: { contains: q, mode: "insensitive" } },
      ],
    })
  }

  if (sentiment) where.sentiment = sentiment
  if (andFilters.length > 0) where.AND = andFilters

  return where
}

async function getArticleFeedPage(options: FeedPageOptions): Promise<FeedPage> {
  const limit = options.limit ?? FEED_PAGE_SIZE
  const where = await buildArticleWhere(options)
  if (!where) return { articles: [], nextCursor: null, hasMore: false }

  const rows = await prisma.newsArticle.findMany({
    where,
    orderBy: [{ pubDate: "desc" }, { id: "desc" }],
    take: limit + 1,
  })

  const pageRows = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const marked = await markUserState(pageRows, options.userId)

  return {
    articles: marked.map(formatArticle),
    nextCursor: hasMore && pageRows.length > 0
      ? encodeArticleCursor(pageRows[pageRows.length - 1])
      : null,
    hasMore,
  }
}

async function getTagFeedPage(options: FeedPageOptions): Promise<FeedPage> {
  const limit = options.limit ?? FEED_PAGE_SIZE
  const tag = options.tag?.trim().toLowerCase()
  if (!tag) return { articles: [], nextCursor: null, hasMore: false }

  let cursor = options.cursor ?? null
  const matches: Prisma.NewsArticleGetPayload<object>[] = []
  const scanBatchSize = 100

  while (matches.length < limit) {
    const rows = await prisma.newsArticle.findMany({
      where: {
        published: true,
        aiTags: { not: null },
        ...articleCursorWhere(cursor),
      },
      orderBy: [{ pubDate: "desc" }, { id: "desc" }],
      take: scanBatchSize + 1,
    })

    const pageRows = rows.slice(0, scanBatchSize)
    const hasMoreRows = rows.length > scanBatchSize

    for (const row of pageRows) {
      const tags = parseTags(row.aiTags)
      if (tags.some((item) => item.toLowerCase() === tag)) {
        matches.push(row)
        if (matches.length === limit) {
          const marked = await markUserState(matches, options.userId)
          return {
            articles: marked.map(formatArticle),
            nextCursor: encodeArticleCursor(row),
            hasMore: true,
          }
        }
      }
    }

    if (!hasMoreRows || pageRows.length === 0) break
    cursor = encodeArticleCursor(pageRows[pageRows.length - 1])
  }

  const marked = await markUserState(matches, options.userId)
  return {
    articles: marked.map(formatArticle),
    nextCursor: null,
    hasMore: false,
  }
}

async function getBookmarkFeedPage(options: FeedPageOptions): Promise<FeedPage> {
  if (!options.userId) return { articles: [], nextCursor: null, hasMore: false }

  const limit = options.limit ?? FEED_PAGE_SIZE
  const rows = await prisma.userBookmark.findMany({
    where: {
      userId: options.userId,
      ...bookmarkCursorWhere(options.cursor),
    },
    include: { article: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  })

  const pageRows = rows.slice(0, limit)
  const hasMore = rows.length > limit

  return {
    articles: pageRows.map((bookmark) =>
      formatArticle({
        ...bookmark.article,
        isRead: false,
        isBookmarked: true,
      })
    ),
    nextCursor: hasMore && pageRows.length > 0
      ? encodeBookmarkCursor(pageRows[pageRows.length - 1])
      : null,
    hasMore,
  }
}

export async function getPaginatedFeed(options: FeedPageOptions): Promise<FeedPage> {
  if (options.scope === "tag") return getTagFeedPage(options)
  if (options.scope === "bookmarks") return getBookmarkFeedPage(options)
  return getArticleFeedPage(options)
}

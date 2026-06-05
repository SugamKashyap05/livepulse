import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export type FeedOptions = {
  userId?: string | null
  topicSlug?: string | null
  sentiment?: string | null
  limit?: number
}

export async function getPersonalisedFeed(options: FeedOptions) {
  const { userId, topicSlug, sentiment, limit = 200 } = options

  let followedTopics: string[] = []
  let userRegion: string | null = null

  if (userId) {
    const [follows, profile] = await Promise.all([
      prisma.userTopicFollow.findMany({
        where: { userId },
        select: { topicSlug: true },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { region: true },
      }),
    ])
    followedTopics = follows.map((follow) => follow.topicSlug)
    userRegion = profile?.region ?? null
  }

  const where: Prisma.NewsArticleWhereInput = { published: true }

  if (topicSlug && topicSlug !== "all") {
    where.topic = topicSlug
  } else if (followedTopics.length > 0) {
    where.topic = { in: followedTopics }
  }

  if (sentiment) {
    where.sentiment = sentiment
  }

  const articles = await prisma.newsArticle.findMany({
    where,
    orderBy: { pubDate: "desc" },
    take: limit,
  })

  if (userId && userRegion && userRegion !== "global") {
    const regionalSources = await prisma.feedSource.findMany({
      where: { region: userRegion, enabled: true },
      select: { name: true },
    })
    const regionalSourceNames = new Set(
      regionalSources.map((source) => source.name)
    )

    articles.sort((a, b) => {
      const aIsRegional = regionalSourceNames.has(a.source) ? -1 : 0
      const bIsRegional = regionalSourceNames.has(b.source) ? -1 : 0
      return aIsRegional - bIsRegional
    })
  }

  if (userId && articles.length > 0) {
    const articleIds = articles.map((article) => article.id)
    const [reads, bookmarks] = await Promise.all([
      prisma.userArticleRead.findMany({
        where: {
          userId,
          articleId: { in: articleIds },
        },
        select: { articleId: true },
      }),
      prisma.userBookmark.findMany({
        where: {
          userId,
          articleId: { in: articleIds },
        },
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

  return articles.map((article) => ({
    ...article,
    isRead: false,
    isBookmarked: false,
  }))
}

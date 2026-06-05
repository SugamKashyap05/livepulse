import { fetchFeedsWithStatus } from "@/lib/fetchFeeds"
import { prisma } from "@/lib/db"

const SYNC_INTERVAL_MS = 5 * 60 * 1000

let isSyncing = false
let syncCount = 0

async function runSync() {
  if (isSyncing) {
    console.log("[LivePulse AutoSync] Skipping - previous sync still running")
    return
  }

  isSyncing = true
  syncCount++

  try {
    console.log(`[LivePulse AutoSync] Starting sync #${syncCount}...`)

    let dbSources = await prisma.feedSource.findMany({
      where: { enabled: true },
      orderBy: { priority: "desc" },
    })

    if (dbSources.length === 0) {
      const { FEED_SOURCES } = await import("@/lib/sources")
      dbSources = FEED_SOURCES.map((source, index) => ({
        id: `seed-${index}`,
        name: source.name,
        url: source.url,
        topic: source.topic,
        slug: source.slug,
        region: source.region || "global",
        enabled: true,
        priority: source.priority || 5,
        lastFetched: null,
        lastStatus: null,
        failCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    }

    const { articles, successNames, failedNames } =
      await fetchFeedsWithStatus(dbSources)

    const slugMap = Object.fromEntries(
      dbSources.map((source) => [source.name, source.slug])
    )

    let saved = 0
    let skipped = 0

    for (const article of articles) {
      try {
        const pubDate = new Date(article.pubDate)
        if (isNaN(pubDate.getTime())) {
          skipped++
          continue
        }

        await prisma.newsArticle.upsert({
          where: { link: article.link },
          update: {
            title: article.title,
            description: article.description || null,
            image: article.image || null,
            fetchedAt: new Date(),
            slug: slugMap[article.source] || article.topic.toLowerCase(),
            source: article.source,
            topic: article.topic.toLowerCase(),
          },
          create: {
            id: article.id,
            title: article.title,
            description: article.description || null,
            link: article.link,
            pubDate,
            source: article.source,
            topic: article.topic.toLowerCase(),
            slug: slugMap[article.source] || article.topic.toLowerCase(),
            image: article.image || null,
          },
        })
        saved++
      } catch (error) {
        console.error(
          `[LivePulse AutoSync] Error saving article: ${article.title}`,
          error
        )
        skipped++
      }
    }

    await prisma.newsArticle.deleteMany({
      where: {
        fetchedAt: {
          lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        },
        aiGenerated: false,
      },
    })

    if (successNames.length > 0) {
      await prisma.feedSource.updateMany({
        where: { name: { in: successNames } },
        data: { lastFetched: new Date(), lastStatus: "ok", failCount: 0 },
      })
    }

    if (failedNames.length > 0) {
      await prisma.feedSource.updateMany({
        where: { name: { in: failedNames } },
        data: {
          lastStatus: "error",
          failCount: { increment: 1 },
        },
      })
    }

    console.log(
      `[LivePulse AutoSync] Sync #${syncCount} done -`,
      `saved: ${saved},`,
      `skipped: ${skipped},`,
      `total: ${articles.length}`
    )
  } catch (error) {
    console.error(`[LivePulse AutoSync] Sync #${syncCount} failed:`, error)
  } finally {
    isSyncing = false
  }
}

export function startAutoSync() {
  console.log("[LivePulse AutoSync] Starting - first sync in 3 seconds...")

  setTimeout(() => {
    runSync()
    setInterval(runSync, SYNC_INTERVAL_MS)
  }, 3000)
}

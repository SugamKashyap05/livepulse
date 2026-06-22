import { fetchFeedsWithStatus } from "@/lib/fetchFeeds"
import { prisma } from "@/lib/db"
import { embedText } from "@/lib/ollama"
import { triggerRagReindex } from "@/lib/ragReindexTrigger"

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const MAX_CONSECUTIVE_FEED_ERRORS = 5

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
        fetchIntervalMinutes: 30,
        lastFetched: null,
        lastStatus: null,
        failCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    }

    const now = Date.now()
    dbSources = dbSources.filter((source) => {
      if (!source.lastFetched) return true
      return now - source.lastFetched.getTime() >= source.fetchIntervalMinutes * 60 * 1000
    })

    if (dbSources.length === 0) {
      console.log("[LivePulse AutoSync] No sources are due for fetching yet")
      return
    }

    const { articles, successNames, failedNames, failedSources } =
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
          "[LivePulse AutoSync] Error saving article:", article.title,
          error
        )
        skipped++
      }
    }

    if (successNames.length > 0) {
      await prisma.feedSource.updateMany({
        where: { name: { in: successNames } },
        data: {
          lastFetched: new Date(),
          lastStatus: "ok",
          failCount: 0,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      })
    }

    if (failedNames.length > 0) {
      for (const failedSource of failedSources) {
        const current = dbSources.find((source) => source.name === failedSource.name)
        const nextFailCount = (current?.failCount ?? 0) + 1
        await prisma.feedSource.updateMany({
          where: { name: failedSource.name },
          data: {
            enabled: nextFailCount < MAX_CONSECUTIVE_FEED_ERRORS,
            lastStatus: "error",
            failCount: { increment: 1 },
            lastErrorAt: new Date(),
            lastErrorMessage:
              nextFailCount >= MAX_CONSECUTIVE_FEED_ERRORS
                ? `Disabled after ${nextFailCount} consecutive errors: ${failedSource.error}`
                : failedSource.error,
          },
        })
      }
    }

    if (articles.length > 0) {
      await prisma.newsArticle.deleteMany({
        where: {
          fetchedAt: {
            lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
          },
          aiGenerated: false,
        },
      })
    }

    console.log(
      `[LivePulse AutoSync] Sync #${syncCount} done -`,
      `saved: ${saved},`,
      `skipped: ${skipped},`,
      `total: ${articles.length}`
    )

    triggerRagReindex()

    if (process.env.NODE_ENV === "development" && syncCount === 1) {
      embedText("warmup").catch(() => {})
    }
  } catch (error) {
    console.error("[LivePulse AutoSync] Sync #", syncCount, "failed:", error)
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

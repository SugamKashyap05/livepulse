import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { fetchFeedsWithStatus } from "@/lib/fetchFeeds"
import { prisma } from "@/lib/db"
import { createAdminActionEvent } from "@/lib/adminDepartments"

export const maxDuration = 60
export const dynamic = "force-dynamic"
const MAX_CONSECUTIVE_FEED_ERRORS = 5

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[LivePulse] Starting admin RSS sync...")

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
        fetchIntervalMinutes: 30,
        lastErrorAt: null,
        lastErrorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    }

    // For manual admin sync, we bypass the fetchIntervalMinutes check
    // to force a refresh of all enabled sources.
    if (dbSources.length === 0) {
      await createAdminActionEvent({
        department: "fetch_news",
        action: "manual_sync.no_due_sources",
        title: "Manual sync skipped",
        body: "No enabled source is due for fetching yet.",
        severity: "info",
        notify: false,
        metadata: { targetType: "department" },
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        saved: 0,
        skipped: 0,
        total: 0,
        message: "No sources are due for fetching yet.",
        sources: {
          ok: 0,
          failed: 0,
        },
      })
    }

    const { articles, successNames, failedNames, failedSources } =
      await fetchFeedsWithStatus(dbSources)

    const slugMap = Object.fromEntries(
      dbSources.map((source) => [source.name, source.slug])
    )

    let saved = 0
    let skipped = 0

    // Parallelize DB upserts in chunks of 20 to prevent Vercel function timeout
    const chunkSize = 20;
    for (let i = 0; i < articles.length; i += chunkSize) {
      const chunk = articles.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (article) => {
          try {
            let pubDate: Date
            try {
              pubDate = new Date(article.pubDate)
              if (isNaN(pubDate.getTime())) pubDate = new Date()
            } catch {
              pubDate = new Date()
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
            console.error("[LivePulse] Error saving article:", article.title, error)
            skipped++
          }
        })
      );
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

    if (articles.length === 0) {
      await createAdminActionEvent({
        department: "fetch_news",
        action: "manual_sync.no_articles",
        title: "Manual sync found no articles",
        body: `Fetched ${successNames.length} sources successfully and ${failedNames.length} failed, but no articles were returned.`,
        severity: failedNames.length > 0 ? "warning" : "info",
        notify: failedNames.length > 0,
        metadata: {
          targetType: "department",
          ok: successNames.length,
          failed: failedNames.length,
        },
      }).catch(() => {})

      return NextResponse.json({
        success: false,
        message: "No articles fetched",
        sources: {
          ok: successNames.length,
          failed: failedNames.length,
        },
      })
    }

    await prisma.newsArticle.deleteMany({
      where: {
        fetchedAt: {
          lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        },
      },
    })

    console.log(`[LivePulse] Admin sync done - saved: ${saved}, skipped: ${skipped}`)

    await createAdminActionEvent({
      department: "fetch_news",
      action: "manual_sync.completed",
      title: "Manual RSS sync completed",
      body: `Saved ${saved}, skipped ${skipped}, fetched ${articles.length}. Sources ok ${successNames.length}, failed ${failedNames.length}.`,
      severity: failedNames.length > 0 ? "warning" : "success",
      notify: failedNames.length > 0,
      metadata: {
        targetType: "department",
        saved,
        skipped,
        total: articles.length,
        ok: successNames.length,
        failed: failedNames.length,
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      saved,
      skipped,
      total: articles.length,
      sources: {
        ok: successNames.length,
        failed: failedNames.length,
      },
    })
  } catch (error) {
    console.error("[LivePulse] Admin sync failed:", error)
    await createAdminActionEvent({
      department: "fetch_news",
      action: "manual_sync.failed",
      title: "Manual RSS sync failed",
      body: error instanceof Error ? error.message : "The manual RSS sync failed.",
      severity: "error",
      notify: true,
      needsEditorReview: true,
      metadata: { targetType: "department" },
    }).catch(() => {})

    return NextResponse.json(
      { success: false, error: "An error occurred" },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { fetchAllFeeds } from "@/lib/fetchFeeds"
import { prisma } from "@/lib/db"
import { FEED_SOURCES } from "@/lib/sources"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const isDev = process.env.NODE_ENV === "development"
  
  if (
    !isDev &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[LivePulse] Starting RSS sync...")
    const articles = await fetchAllFeeds()

    if (articles.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No articles fetched",
      })
    }

    const slugMap = Object.fromEntries(
      FEED_SOURCES.map((s) => [s.name, s.slug])
    )

    let saved = 0
    let skipped = 0

    for (const article of articles) {
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
            topic: article.topic,
          },
          create: {
            id: article.id,
            title: article.title,
            description: article.description || null,
            link: article.link,
            pubDate,
            source: article.source,
            topic: article.topic,
            slug: slugMap[article.source] || article.topic.toLowerCase(),
            image: article.image || null,
          },
        })
        saved++
      } catch (error) {
        console.error(`[LivePulse] Error saving article: ${article.title}`, error)
        skipped++
      }
    }

    await prisma.newsArticle.deleteMany({
      where: {
        fetchedAt: {
          lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        },
      },
    })

    console.log(`[LivePulse] Sync done — saved: ${saved}, skipped: ${skipped}`)

    return NextResponse.json({
      success: true,
      saved,
      skipped,
      total: articles.length,
    })
  } catch (error) {
    console.error("[LivePulse] Sync failed:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

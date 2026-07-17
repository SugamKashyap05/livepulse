import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

function getDateRange(range: string | null): Date {
  const now = new Date()
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case "24h":
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const range = req.nextUrl.searchParams.get("range")
  const since = getDateRange(range)

  try {
    const [
      eventsByType,
      totalEvents,
      authSplit,
      recentTimeline,
    ] = await Promise.all([
      // Event volume by type
      prisma.userArticleEvent.groupBy({
        by: ["type"],
        where: { occurredAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      // Total event count
      prisma.userArticleEvent.count({
        where: { occurredAt: { gte: since } },
      }),

      // Authenticated vs anonymous split
      prisma.$queryRawUnsafe<{ label: string; count: bigint }[]>(
        `SELECT
          CASE
            WHEN "userId" IS NOT NULL THEN 'authenticated'
            ELSE 'anonymous'
          END AS label,
          COUNT(*) AS count
        FROM "UserArticleEvent"
        WHERE "occurredAt" >= $1
        GROUP BY label`,
        since
      ),

      // Hourly timeline (last 48h max, capped by range)
      prisma.$queryRawUnsafe<{ hour: string; count: bigint }[]>(
        `SELECT
          date_trunc('hour', "occurredAt") AS hour,
          COUNT(*) AS count
        FROM "UserArticleEvent"
        WHERE "occurredAt" >= $1
        GROUP BY hour
        ORDER BY hour ASC`,
        since
      ),
    ])

    // Build engagement funnel from event counts
    const typeCounts: Record<string, number> = {}
    for (const row of eventsByType) {
      typeCounts[row.type] = row._count.id
    }

    const funnel = {
      impressions: typeCounts["impression"] ?? 0,
      clicks: typeCounts["click"] ?? 0,
      reads: typeCounts["read"] ?? 0,
      bookmarks: typeCounts["bookmark"] ?? 0,
      likes: typeCounts["like"] ?? 0,
      dislikes: typeCounts["dislike"] ?? 0,
      hides: typeCounts["hide"] ?? 0,
      shares: typeCounts["share"] ?? 0,
    }

    // Compute conversion rates
    const ctr =
      funnel.impressions > 0
        ? ((funnel.clicks / funnel.impressions) * 100).toFixed(2)
        : "0.00"
    const readRate =
      funnel.clicks > 0
        ? ((funnel.reads / funnel.clicks) * 100).toFixed(2)
        : "0.00"
    const bookmarkRate =
      funnel.reads > 0
        ? ((funnel.bookmarks / funnel.reads) * 100).toFixed(2)
        : "0.00"

    return NextResponse.json({
      range: range || "24h",
      since: since.toISOString(),
      totalEvents,
      eventsByType: eventsByType.map((row) => ({
        type: row.type,
        count: row._count.id,
      })),
      funnel,
      conversionRates: { ctr, readRate, bookmarkRate },
      authSplit: authSplit.map((row) => ({
        label: row.label,
        count: Number(row.count),
      })),
      timeline: recentTimeline.map((row) => ({
        hour: row.hour,
        count: Number(row.count),
      })),
    })
  } catch (error) {
    console.error("[Admin Analytics] Error:", error)
    return NextResponse.json(
      { error: "Analytics query failed" },
      { status: 500 }
    )
  }
}

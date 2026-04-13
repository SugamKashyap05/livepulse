import { prisma } from "@/lib/db"
import { FEED_SOURCES } from "@/lib/sources"
import SourcesClient from "@/components/admin/SourcesClient"

export const dynamic = "force-dynamic"

export default async function SourcesPage() {
  const counts = await prisma.newsArticle.groupBy({
    by: ["source"],
    _count: { id: true },
  })

  const latest = await prisma.newsArticle.groupBy({
    by: ["source"],
    _max: { fetchedAt: true },
  })

  const countMap = Object.fromEntries(
    counts.map((c) => [c.source, c._count.id])
  )
  const latestMap = Object.fromEntries(
    latest.map((l) => [l.source, l._max.fetchedAt])
  )

  const sources = FEED_SOURCES.map((s) => ({
    ...s,
    articleCount: countMap[s.name] || 0,
    lastFetched: latestMap[s.name]
      ? new Date(latestMap[s.name]!).toLocaleString()
      : "Never",
  }))

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          Sources
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          {FEED_SOURCES.length} RSS feeds configured
        </p>
      </div>
      <SourcesClient sources={sources} />
    </div>
  )
}

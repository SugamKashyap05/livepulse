import { prisma } from "@/lib/db"
import { FEED_SOURCES } from "@/lib/sources"
import SourcesClient from "@/components/admin/SourcesClient"

export const dynamic = "force-dynamic"

export default async function SourcesPage() {
  const counts = await prisma.newsArticle.groupBy({
    by: ["source"],
    _count: { id: true },
  })

  const countMap = Object.fromEntries(
    counts.map((count) => [count.source, count._count.id])
  )

  let dbSources = await prisma.feedSource.findMany({
    orderBy: [{ topic: "asc" }, { priority: "desc" }, { name: "asc" }],
  })

  if (dbSources.length === 0) {
    dbSources = FEED_SOURCES.map((source, index) => ({
      id: `fallback-${index}`,
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

  const sources = dbSources.map((source) => ({
    ...source,
    articleCount: countMap[source.name] || 0,
    lastFetchedLabel: source.lastFetched
      ? new Date(source.lastFetched).toLocaleString()
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
          {sources.length} RSS feeds configured
        </p>
      </div>
      <SourcesClient sources={sources} />
    </div>
  )
}

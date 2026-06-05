import { prisma } from "@/lib/db"
import { FEED_SOURCES } from "@/lib/sources"
import HealthClient from "@/components/admin/HealthClient"

export const dynamic = "force-dynamic"

export default async function HealthPage() {
  let dbSources = await prisma.feedSource.findMany({
    where: { enabled: true },
    orderBy: [{ topic: "asc" }, { priority: "desc" }],
    select: { name: true, url: true, topic: true },
  })

  if (dbSources.length === 0) {
    dbSources = FEED_SOURCES.map((source) => ({
      name: source.name,
      url: source.url,
      topic: source.topic,
    }))
  }

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
          Feed Health
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          Live ping all RSS sources to check availability
        </p>
      </div>
      <HealthClient sources={dbSources} />
    </div>
  )
}

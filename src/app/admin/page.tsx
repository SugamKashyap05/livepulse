import { prisma } from "@/lib/db"
import { FEED_SOURCES } from "@/lib/sources"
import AdminSync from "@/components/admin/AdminSync"
import AiBatchClient from "@/components/admin/AiBatchClient"

export const dynamic = "force-dynamic"

async function getStats() {
  const total = await prisma.newsArticle.count()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCount = await prisma.newsArticle.count({
    where: { fetchedAt: { gte: today } },
  })

  const oldest = await prisma.newsArticle.findFirst({
    orderBy: { pubDate: "asc" },
    select: { pubDate: true },
  })

  const newest = await prisma.newsArticle.findFirst({
    orderBy: { pubDate: "desc" },
    select: { fetchedAt: true },
  })

  const byTopic = await prisma.newsArticle.groupBy({
    by: ["topic"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  })

  const bySource = await prisma.newsArticle.groupBy({
    by: ["source"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  })

  return { total, todayCount, oldest, newest, byTopic, bySource }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  const lastSync = stats.newest?.fetchedAt
    ? new Date(stats.newest.fetchedAt).toLocaleString()
    : "Never"

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          Dashboard
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          Last sync: {lastSync}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 32,
      }}>
        {[
          { label: "Total Articles", value: stats.total, color: "var(--accent)" },
          { label: "Added Today", value: stats.todayCount, color: "#6c8fff" },
          { label: "Active Sources", value: FEED_SOURCES.length, color: "#f5c542" },
          { label: "Topics Covered", value: stats.byTopic.length, color: "#a78bfa" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "20px",
            }}
          >
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 10,
            }}>
              {stat.label}
            </div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              color: stat.color,
              lineHeight: 1,
            }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sync control */}
      <AdminSync />

      {/* AI Batch processor */}
      <div style={{ marginTop: 24 }}>
        <AiBatchClient />
      </div>

      {/* Articles by topic */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginTop: 32,
      }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 20,
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 16,
          }}>
            Articles by Topic
          </div>
          {stats.byTopic.map((t) => (
            <div
              key={t.topic}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text)" }}>{t.topic}</span>
              <span style={{ color: "var(--accent)" }}>{t._count.id}</span>
            </div>
          ))}
        </div>

        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 20,
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 16,
          }}>
            Articles by Source
          </div>
          {stats.bySource.map((s) => (
            <div
              key={s.source}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text)" }}>{s.source}</span>
              <span style={{ color: "var(--accent)" }}>{s._count.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

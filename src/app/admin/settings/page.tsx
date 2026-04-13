import { prisma } from "@/lib/db"
import SettingsClient from "@/components/admin/SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const total = await prisma.newsArticle.count()

  const oldest = await prisma.newsArticle.findFirst({
    orderBy: { pubDate: "asc" },
    select: { pubDate: true },
  })

  const oldestDate = oldest?.pubDate
    ? new Date(oldest.pubDate).toLocaleDateString()
    : "N/A"

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
          Settings
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          Configure sync and data retention
        </p>
      </div>
      <SettingsClient total={total} oldestDate={oldestDate} />
    </div>
  )
}

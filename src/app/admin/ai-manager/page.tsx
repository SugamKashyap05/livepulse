import { prisma } from "@/lib/db"
import AiManagerClient from "@/components/admin/AiManagerClient"
import { MODELS } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export default async function AiManagerPage() {
  const totalArticles = await prisma.newsArticle.count()
  const processed = await prisma.newsArticle.count({
    where: { aiProcessed: true },
  })
  const withSentiment = await prisma.newsArticle.count({
    where: { sentiment: { not: null } },
  })
  const withSummary = await prisma.newsArticle.count({
    where: { summary: { not: null } },
  })
  const withTags = await prisma.newsArticle.count({
    where: { aiTags: { not: null } },
  })

  const logs = await prisma.aiLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const digests = await prisma.dailyDigest.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const serializedLogs = logs.map((l: { id: string; action: string; model: string; prompt: string | null; tokens: number | null; ms: number | null; success: boolean; error: string | null; createdAt: Date }) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }))

  const serializedDigests = digests.map((d: { id: string; date: string; content: string; model: string | null; createdAt: Date }) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }))
  const coverage = totalArticles > 0
    ? Math.round((processed / totalArticles) * 100)
    : 0

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
          AI Manager
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          Control all AI features from one place
        </p>
      </div>

      {/* AI Coverage stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 28,
      }}>
        {[
          { label: "Total Articles", value: totalArticles, color: "var(--text)" },
          { label: "AI Tagged", value: withTags, color: "#6c8fff" },
          { label: "Sentiment Done", value: withSentiment, color: "#4af0c4" },
          { label: "Summarized", value: withSummary, color: "#a78bfa" },
          { label: "Coverage", value: `${coverage}%`, color: "#f5c542" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "16px",
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 8,
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 26,
              fontWeight: 700,
              color: s.color,
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <AiManagerClient
        logs={serializedLogs}
        digests={serializedDigests}
        models={MODELS}
      />
    </div>
  )
}

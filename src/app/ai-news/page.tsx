import { prisma } from "@/lib/db"
import Header from "@/components/Header"
import NewsCard from "@/components/NewsCard"
import { formatDistanceToNow } from "date-fns"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function AiNewsPage() {
  const articles = await prisma.newsArticle.findMany({
    where: {
      aiGenerated: true,
      published: true
    },
    orderBy: { pubDate: "desc" },
    take: 50
  })

  const news = articles.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description || "",
    link: a.link,
    pubDate: formatDistanceToNow(new Date(a.pubDate), { addSuffix: true }),
    source: a.source,
    topic: a.topic,
    image: a.image || undefined,
    summary: a.summary || undefined,
    sentiment: a.sentiment || undefined,
    aiTags: a.aiTags || undefined,
    aiGenerated: true,
    factScore: a.factScore ?? null,
    biasAnalysis: a.biasAnalysis ?? null,
  }))

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40, borderBottom: "1px solid var(--border)", paddingBottom: 20 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 48,
            fontWeight: 900,
            marginBottom: 12
          }}>AI Intelligence</h1>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            color: "var(--accent)",
            maxWidth: 600
          }}>
            Autonomous reports synthesized by LivePulse agents using multi-source cross-referencing and database context.
          </p>
        </div>

        {news.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: 24,
          }}>
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: "center",
            padding: "100px 0",
            color: "var(--muted)",
            fontFamily: "'IBM Plex Mono', monospace"
          }}>
            NO AI REPORTS HAVE BEEN PUBLISHED YET.
          </div>
        )}
      </main>
    </>
  )
}

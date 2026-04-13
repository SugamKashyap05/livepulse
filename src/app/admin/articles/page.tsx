import { prisma } from "@/lib/db"
import ArticlesClient from "@/components/admin/ArticlesClient"

export const dynamic = "force-dynamic"

export default async function ArticlesPage() {
  const articles = await prisma.newsArticle.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      source: true,
      topic: true,
      pubDate: true,
      link: true,
      fetchedAt: true,
    },
  })

  const serialized = articles.map((a) => ({
    ...a,
    pubDate: a.pubDate.toISOString(),
    fetchedAt: a.fetchedAt.toISOString(),
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
          Articles
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          {articles.length} articles in database
        </p>
      </div>
      <ArticlesClient articles={serialized} />
    </div>
  )
}

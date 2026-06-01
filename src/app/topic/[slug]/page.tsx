import { prisma } from "@/lib/db"
import { ALL_TOPICS, AreaTopic } from "@/lib/sources"
import Header from "@/components/Header"
import NewsCard from "@/components/NewsCard"
import { NewsItem } from "@/types/news"
import { formatDistanceToNow } from "date-fns"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"


export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const topic = ALL_TOPICS.find((t) => t.slug === slug)
  if (!topic) notFound()

  const isAll = slug === "all"
  const articles = await prisma.newsArticle.findMany({
    where: isAll
      ? { published: true }
      : { slug, published: true },
    orderBy: { pubDate: "desc" },
    take: 100,
  })

  const news: NewsItem[] = articles.map((a) => ({
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
  }))

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        <div style={{
          marginBottom: 24,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--accent)",
        }}>
          ◆ {topic?.label || slug} — {news.length} articles
        </div>

        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 28,
        }}>
          {ALL_TOPICS.map((t: AreaTopic) => (
            <a
              key={t.slug}
              href={t.slug === "all" ? "/" : `/topic/${t.slug}`}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "6px 14px",
                border: "1px solid var(--border2)",
                borderRadius: 2,
                color: t.slug === slug ? "var(--accent)" : "var(--muted)",
                borderColor: t.slug === slug ? "var(--accent)" : "var(--border2)",
                textDecoration: "none",
              }}
            >
              {t.label}
            </a>
          ))}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {news.map((item: NewsItem) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </main>
    </>
  )
}

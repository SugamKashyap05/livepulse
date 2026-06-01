import { prisma } from "@/lib/db"
import { fetchAllFeeds } from "@/lib/fetchFeeds"
import Header from "@/components/Header"
import NewsCard from "@/components/NewsCard"
import { ALL_TOPICS, AreaTopic } from "@/lib/sources"
import { NewsItem } from "@/types/news"

import { formatDistanceToNow } from "date-fns"

export const revalidate = 300
export const dynamic = "force-dynamic"

async function getNews(): Promise<NewsItem[]> {
  try {
    const articles = await prisma.newsArticle.findMany({
      where: { published: true },
      orderBy: { pubDate: "desc" },
      take: 200,
    })

    const formattedArticles = articles.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description || "",
      link: a.link,
      pubDate: formatDistanceToNow(new Date(a.pubDate), { addSuffix: true }),
      source: a.source,
      topic: a.topic,
      image: a.image || undefined,
    }))

    if (formattedArticles.length === 0) {
      console.log("[LivePulse] DB empty — doing live fetch...")
      const live = await fetchAllFeeds()
      return live.map(item => ({
        ...item,
        pubDate: formatDistanceToNow(new Date(item.pubDate), { addSuffix: true })
      }))
    }

    return formattedArticles
  } catch (error) {
    console.error("[LivePulse] DB read failed, falling back to RSS:", error)
    const live = await fetchAllFeeds()
    return live.map(item => ({
      ...item,
      pubDate: formatDistanceToNow(new Date(item.pubDate), { addSuffix: true })
    }))
  }
}

export default async function HomePage() {
  const news = await getNews()

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 24,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
        }}>
          <span style={{ color: "var(--accent)" }}>◆ {news.length} articles loaded</span>
          <span>·</span>
          <span>13 sources active</span>
          <span>·</span>
          <span>Auto-refresh every 5 min</span>
        </div>

        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 28,
        }}>
          {ALL_TOPICS.map((topic: AreaTopic) => (
            <a
              key={topic.slug}
              href={topic.slug === "all" ? "/" : `/topic/${topic.slug}`}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "6px 14px",
                border: "1px solid var(--border2)",
                borderRadius: 2,
                color: topic.slug === "all" ? "var(--accent)" : "var(--muted)",
                borderColor: topic.slug === "all" ? "var(--accent)" : "var(--border2)",
                textDecoration: "none",
              }}
            >
              {topic.label}
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
        {news.length === 0 && (

          <div style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: "'IBM Plex Mono', monospace",
            color: "var(--muted)",
          }}>
            No articles loaded. Check your internet connection.
          </div>
        )}
      </main>
    </>
  )
}

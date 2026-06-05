import NewsCard from "@/components/NewsCard"
import type { NewsItem } from "@/types/news"

type NewsGridProps = {
  articles: NewsItem[]
  loading?: boolean
}

export default function NewsGrid({ articles, loading = false }: NewsGridProps) {
  if (loading) {
    return (
      <div style={gridStyle}>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            style={{
              minHeight: 280,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 120, background: "var(--surface2)" }} />
            <div style={{ padding: 16 }}>
              <div style={skeletonLineStyle} />
              <div style={{ ...skeletonLineStyle, width: "82%" }} />
              <div style={{ ...skeletonLineStyle, width: "54%" }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div style={{
        textAlign: "center",
        padding: "80px 0",
        fontFamily: "'IBM Plex Mono', monospace",
        color: "var(--muted)",
      }}>
        No articles found.
      </div>
    )
  }

  return (
    <div style={gridStyle}>
      {articles.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}
    </div>
  )
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
  gap: 20,
} as const

const skeletonLineStyle = {
  height: 10,
  width: "100%",
  marginBottom: 10,
  borderRadius: 2,
  background: "var(--surface2)",
} as const

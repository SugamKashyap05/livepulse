import NewsCard from "@/components/NewsCard"
import type { NewsItem } from "@/types/news"

export type NewsGridFeedContext = {
  scope: string
  topic?: string | null
  sentiment?: string | null
  q?: string | null
  tag?: string | null
  surface?: string
}

type NewsGridProps = {
  articles: NewsItem[]
  loading?: boolean
  feedContext?: NewsGridFeedContext
}

export default function NewsGrid({ articles, loading = false, feedContext }: NewsGridProps) {
  if (loading) {
    return (
      <div className="article-grid" style={gridStyle}>
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
    <div className="article-grid" style={gridStyle}>
      {articles.map((item, index) => (
        <NewsCard
          key={item.id}
          item={item}
          feedContext={feedContext}
          feedPosition={index}
          priority={index === 0}
        />
      ))}
    </div>
  )
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
  gap: 24,
} as const

const skeletonLineStyle = {
  height: 10,
  width: "100%",
  marginBottom: 10,
  borderRadius: 2,
  background: "var(--surface2)",
} as const

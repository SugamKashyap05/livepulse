"use client"

import { useState } from "react"
import NewsGrid from "@/components/NewsGrid"
import Regwall from "@/components/Regwall"
import type { NewsItem } from "@/types/news"
import type { FeedScope } from "@/lib/paginatedFeed"

type ArticleFeedProps = {
  initialArticles: NewsItem[]
  initialCursor: string | null
  initialHasMore: boolean
  scope: FeedScope
  topic?: string | null
  sentiment?: string | null
  q?: string | null
  tag?: string | null
  registrationRequired?: boolean
}

type FeedResponse = {
  articles: NewsItem[]
  nextCursor: string | null
  hasMore: boolean
  error?: string
}

export default function ArticleFeed({
  initialArticles,
  initialCursor,
  initialHasMore,
  scope,
  topic,
  sentiment,
  q,
  tag,
  registrationRequired = false,
}: ArticleFeedProps) {
  const [articles, setArticles] = useState(initialArticles)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRegwall, setShowRegwall] = useState(false)

  async function loadMore() {
    if (loading || !hasMore || !cursor) return

    if (registrationRequired) {
      setShowRegwall(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ scope, cursor })
      if (topic) params.set("topic", topic)
      if (sentiment) params.set("sentiment", sentiment)
      if (q) params.set("q", q)
      if (tag) params.set("tag", tag)

      const response = await fetch(`/api/feed?${params.toString()}`)
      const data = (await response.json()) as FeedResponse

      if (!response.ok || data.error) {
        setError(data.error || "Could not load more articles.")
        return
      }

      setArticles((previous) => {
        const seen = new Set(previous.map((article) => article.id))
        const next = data.articles.filter((article) => !seen.has(article.id))
        return [...previous, ...next]
      })
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch {
      setError("Could not load more articles.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NewsGrid
        articles={articles}
        feedContext={{
          scope,
          topic,
          sentiment,
          q,
          tag,
          surface: "feed",
        }}
      />

      {showRegwall && (
        <Regwall onClose={() => setShowRegwall(false)} />
      )}

      {error && (
        <div style={{
          marginTop: 18,
          textAlign: "center",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--red)",
        }}>
          {error}
        </div>
      )}

      {hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              padding: "9px 18px",
              background: loading ? "var(--surface2)" : "var(--surface)",
              color: loading ? "var(--muted)" : "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      ) : articles.length > 0 ? (
        <div style={{
          marginTop: 28,
          textAlign: "center",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "1px",
        }}>
          End of feed
        </div>
      ) : null}
    </>
  )
}

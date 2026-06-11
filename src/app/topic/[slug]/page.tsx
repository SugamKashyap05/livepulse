import Link from "next/link"
import { notFound } from "next/navigation"
import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import TopicTabs from "@/components/TopicTabs"
import { getCurrentUserId, isNeonAuthConfigured } from "@/lib/auth"
import { getPaginatedFeed } from "@/lib/paginatedFeed"
import { ALL_TOPICS } from "@/lib/sources"

export const dynamic = "force-dynamic"

function normalizeSentiment(value?: string): string | null {
  return value && ["positive", "neutral", "negative"].includes(value)
    ? value
    : null
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sentiment?: string }>
}) {
  const { slug } = await params
  const { sentiment: sentimentParam } = await searchParams
  const sentiment = normalizeSentiment(sentimentParam)
  const topic = ALL_TOPICS.find((item) => item.slug === slug)
  if (!topic) notFound()

  const userId = await getCurrentUserId()
  const registrationRequired = isNeonAuthConfigured() && !userId
  const feed = await getPaginatedFeed({
    scope: "topic",
    userId,
    topicSlug: slug,
    sentiment,
  })

  return (
    <>
      <Header />
      <main className="public-page-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{
          marginBottom: 24,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--accent)",
        }}>
          {topic.label} - {feed.articles.length} articles loaded
        </div>

        <TopicTabs activeSlug={slug} />
        <SentimentFilters sentiment={sentiment} basePath={`/topic/${slug}`} />
        <ArticleFeed
          initialArticles={feed.articles}
          initialCursor={feed.nextCursor}
          initialHasMore={feed.hasMore}
          scope="topic"
          topic={slug}
          sentiment={sentiment}
          registrationRequired={registrationRequired}
        />
      </main>
    </>
  )
}

function SentimentFilters({
  sentiment,
  basePath,
}: {
  sentiment: string | null
  basePath: string
}) {
  const filters = [
    { label: "ALL", value: null, dot: null },
    { label: "POSITIVE", value: "positive", dot: "#3ecf8e" },
    { label: "NEUTRAL", value: "neutral", dot: "#718096" },
    { label: "NEGATIVE", value: "negative", dot: "#f56565" },
  ]

  return (
    <div
      className="scroll-row feed-filter-row"
      style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}
    >
      {filters.map((filter) => {
        const isActive = sentiment === filter.value ||
          (filter.value === null && !sentiment)
        return (
          <Link
            key={filter.label}
            href={filter.value ? `${basePath}?sentiment=${filter.value}` : basePath}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "1px",
              padding: "4px 10px",
              background: isActive
                ? "rgba(108,143,255,0.1)"
                : "transparent",
              color: isActive ? "var(--accent)" : "var(--muted)",
              border: `1px solid ${isActive
                ? "rgba(108,143,255,0.3)"
                : "var(--border)"}`,
              borderRadius: 20,
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
          >
            {filter.dot && (
              <span style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isActive ? filter.dot : "var(--muted2)",
                display: "inline-block",
                flexShrink: 0,
              }} />
            )}
            {filter.label}
          </Link>
        )
      })}
    </div>
  )
}

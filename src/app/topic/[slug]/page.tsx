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
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
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
    { label: "All", value: null },
    { label: "Positive", value: "positive" },
    { label: "Neutral", value: "neutral" },
    { label: "Negative", value: "negative" },
  ]

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {filters.map((filter) => (
        <Link
          key={filter.label}
          href={filter.value ? `${basePath}?sentiment=${filter.value}` : basePath}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            padding: "4px 10px",
            background: sentiment === filter.value ? "var(--accent)" : "var(--surface)",
            color: sentiment === filter.value ? "#000" : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            textDecoration: "none",
          }}
        >
          {filter.label}
        </Link>
      ))}
    </div>
  )
}

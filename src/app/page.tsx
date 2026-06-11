import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import TopicTabs from "@/components/TopicTabs"
import { fetchAllFeeds } from "@/lib/fetchFeeds"
import { getCurrentUserId, isNeonAuthConfigured } from "@/lib/auth"
import { getPaginatedFeed, type FeedPage } from "@/lib/paginatedFeed"

export const revalidate = 300
export const dynamic = "force-dynamic"

function normalizeSentiment(value?: string): string | null {
  return value && ["positive", "neutral", "negative"].includes(value)
    ? value
    : null
}

async function getNews(
  userId: string | null,
  sentiment?: string | null
): Promise<FeedPage> {
  try {
    const feed = await getPaginatedFeed({
      scope: "home",
      userId,
      sentiment,
    })

    if (feed.articles.length === 0 && !sentiment) {
      console.log("[LivePulse] DB empty - doing live fetch...")
      const live = await fetchAllFeeds()
      return {
        articles: live.map((item) => ({
          ...item,
          pubDate: formatDistanceToNow(new Date(item.pubDate), { addSuffix: true }),
        })),
        nextCursor: null,
        hasMore: false,
      }
    }

    return feed
  } catch (error) {
    console.error("[LivePulse] DB read failed, falling back to RSS:", error)
    const live = await fetchAllFeeds()
    return {
      articles: live.map((item) => ({
        ...item,
        pubDate: formatDistanceToNow(new Date(item.pubDate), { addSuffix: true }),
      })),
      nextCursor: null,
      hasMore: false,
    }
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sentiment?: string }>
}) {
  const { sentiment: sentimentParam } = await searchParams
  const sentiment = normalizeSentiment(sentimentParam)
  const userId = await getCurrentUserId()
  const feed = await getNews(userId, sentiment)
  const registrationRequired = isNeonAuthConfigured() && !userId

  return (
    <>
      <Header />
      <main style={{ minHeight: "100dvh" }}>
        <div className="public-hero" style={{
          borderBottom: "1px solid var(--border)",
          padding: "32px 32px 20px",
          background: `
            radial-gradient(
              ellipse 80% 120% at 50% -30%,
              rgba(108,143,255,0.12) 0%,
              rgba(108,143,255,0.04) 40%,
              transparent 70%)
          `,
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--muted)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}>
              Global Intelligence Feed
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 900,
              fontStyle: "italic",
              color: "var(--text)",
              lineHeight: 1.1,
              marginBottom: 20,
            }}>
              Today&apos;s World, Analysed.
            </h1>
            <TopicTabs activeSlug="all" />
          </div>
        </div>

        <div className="public-page-shell" style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "20px 32px 32px",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            marginBottom: 12,
            letterSpacing: "0.5px",
          }}>
            <span style={{ color: "var(--accent)" }}>
              {feed.articles.length}
            </span>
            {" articles - "}
            <span>33 sources active</span>
          </div>

          <SentimentFilters sentiment={sentiment} basePath="/" />
          <ArticleFeed
            initialArticles={feed.articles}
            initialCursor={feed.nextCursor}
            initialHasMore={feed.hasMore}
            scope="home"
            sentiment={sentiment}
            registrationRequired={registrationRequired}
          />
        </div>
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

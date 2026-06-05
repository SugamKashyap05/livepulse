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
      <main style={{ minHeight: "100vh" }}>
        <div style={{
          borderBottom: "1px solid var(--border)",
          padding: "40px 32px 32px",
          background: `
            radial-gradient(ellipse 60% 50% at 50% -10%,
              rgba(108,143,255,0.06) 0%,
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

        <div style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "32px 32px",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 20,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            flexWrap: "wrap",
          }}>
            <span style={{ color: "var(--accent)" }}>
              {feed.articles.length} articles loaded
            </span>
            <span style={{ color: "var(--muted2)" }}>-</span>
            <span>33 sources active</span>
            <span style={{ color: "var(--muted2)" }}>-</span>
            <span>Auto-refresh every 5 min</span>
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
    { label: "All", value: null },
    { label: "Positive", value: "positive" },
    { label: "Neutral", value: "neutral" },
    { label: "Negative", value: "negative" },
  ]

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      {filters.map((filter) => (
        <Link
          key={filter.label}
          href={filter.value ? `${basePath}?sentiment=${filter.value}` : basePath}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "5px 12px",
            background: sentiment === filter.value ? "var(--accent)" : "var(--surface)",
            color: sentiment === filter.value ? "#000" : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 3,
          }}
        >
          {filter.label}
        </Link>
      ))}
    </div>
  )
}

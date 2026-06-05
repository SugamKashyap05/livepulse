import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import { getCurrentUserId, isNeonAuthConfigured } from "@/lib/auth"
import { getPaginatedFeed } from "@/lib/paginatedFeed"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function AiNewsPage() {
  const userId = await getCurrentUserId()
  const registrationRequired = isNeonAuthConfigured() && !userId
  const feed = await getPaginatedFeed({
    scope: "ai-news",
    userId,
  })

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40, borderBottom: "1px solid var(--border)", paddingBottom: 20 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 48,
            fontWeight: 900,
            marginBottom: 12,
          }}>AI Intelligence</h1>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            color: "var(--accent)",
            maxWidth: 600,
          }}>
            Autonomous reports synthesized by LivePulse agents using multi-source cross-referencing and database context.
          </p>
        </div>

        {feed.articles.length > 0 ? (
          <ArticleFeed
            initialArticles={feed.articles}
            initialCursor={feed.nextCursor}
            initialHasMore={feed.hasMore}
            scope="ai-news"
            registrationRequired={registrationRequired}
          />
        ) : (
          <div style={{
            textAlign: "center",
            padding: "100px 0",
            color: "var(--muted)",
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            NO AI REPORTS HAVE BEEN PUBLISHED YET.
          </div>
        )}
      </main>
    </>
  )
}

import { redirect } from "next/navigation"
import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import { getCurrentUserId } from "@/lib/auth"
import { getPaginatedFeed } from "@/lib/paginatedFeed"

export const dynamic = "force-dynamic"

export default async function BookmarksPage() {
  const userId = await getCurrentUserId()
  if (!userId) {
    redirect("/login?next=/bookmarks")
  }

  const feed = await getPaginatedFeed({
    scope: "bookmarks",
    userId,
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
          Saved articles - {feed.articles.length} loaded
        </div>

        {feed.articles.length > 0 ? (
          <ArticleFeed
            initialArticles={feed.articles}
            initialCursor={feed.nextCursor}
            initialHasMore={feed.hasMore}
            scope="bookmarks"
          />
        ) : (
          <div style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: "'IBM Plex Mono', monospace",
            color: "var(--muted)",
          }}>
            No bookmarks yet. Save articles from the home page.
          </div>
        )}
      </main>
    </>
  )
}

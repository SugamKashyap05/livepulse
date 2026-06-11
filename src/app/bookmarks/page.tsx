import { redirect } from "next/navigation"
import Link from "next/link"
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
      <main className="public-page-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
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
            No bookmarks yet.{" "}
            <Link
              href="/"
              style={{
                color: "var(--accent)",
                display: "inline-flex",
                minHeight: 44,
                alignItems: "center",
              }}
            >
              Browse the feed
            </Link>
          </div>
        )}
      </main>
    </>
  )
}

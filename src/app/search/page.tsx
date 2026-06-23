import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import SearchBar from "@/components/SearchBar"
import { getCurrentUserId, isNeonAuthConfigured } from "@/lib/auth"
import { getPaginatedFeed } from "@/lib/paginatedFeed"

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string
  }>
}

export const dynamic = "force-dynamic"

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = searchParams ? await searchParams : {}
  const q = typeof params.q === "string" ? params.q.trim() : ""
  const userId = await getCurrentUserId()
  const registrationRequired = isNeonAuthConfigured() && !userId
  const feed = q.length >= 2
    ? await getPaginatedFeed({ scope: "search", userId, q })
    : { articles: [], nextCursor: null, hasMore: false }

  return (
    <>
      <Header />
      <main className="public-page-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div className="search-page-form" style={{ maxWidth: 480, marginBottom: 20 }}>
          <SearchBar />
        </div>
        <div style={{
          marginBottom: 24,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--accent)",
        }}>
          {q.length >= 2
            ? `${feed.articles.length} articles found for "${q}"`
            : "Enter at least 2 characters to search"}
        </div>

        {q.length >= 2 && feed.articles.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: "'IBM Plex Mono', monospace",
            color: "var(--muted)",
          }}>
            No results for &quot;{q}&quot;.
          </div>
        ) : q.length < 2 ? (
          <div style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: "'IBM Plex Mono', monospace",
            color: "var(--muted)",
          }}>
            Search across all sources and topics.
          </div>
        ) : (
          <ArticleFeed
            initialArticles={feed.articles}
            initialCursor={feed.nextCursor}
            initialHasMore={feed.hasMore}
            scope="search"
            q={q}
            registrationRequired={registrationRequired}
          />
        )}
      </main>
    </>
  )
}

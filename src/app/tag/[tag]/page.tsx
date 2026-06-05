import { notFound } from "next/navigation"
import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import { getCurrentUserId, isNeonAuthConfigured } from "@/lib/auth"
import { getPaginatedFeed } from "@/lib/paginatedFeed"

export const dynamic = "force-dynamic"

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>
}) {
  const { tag } = await params
  const decodedTag = decodeURIComponent(tag)
  const userId = await getCurrentUserId()
  const registrationRequired = isNeonAuthConfigured() && !userId
  const feed = await getPaginatedFeed({
    scope: "tag",
    userId,
    tag: decodedTag,
  })

  if (feed.articles.length === 0) notFound()

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "1px",
          marginBottom: 8,
        }}>
          TAG
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          color: "var(--text)",
          margin: "0 0 32px",
        }}>
          #{decodedTag}
        </h1>
        <ArticleFeed
          initialArticles={feed.articles}
          initialCursor={feed.nextCursor}
          initialHasMore={feed.hasMore}
          scope="tag"
          tag={decodedTag}
          registrationRequired={registrationRequired}
        />
      </main>
    </>
  )
}

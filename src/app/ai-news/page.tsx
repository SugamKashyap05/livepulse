import ArticleFeed from "@/components/ArticleFeed"
import Header from "@/components/Header"
import { getCurrentUserId, isNeonAuthConfigured } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPaginatedFeed } from "@/lib/paginatedFeed"

export const revalidate = 60
export const dynamic = "force-dynamic"

export default async function AiNewsPage() {
  const userId = await getCurrentUserId()
  const registrationRequired = isNeonAuthConfigured() && !userId
  const [feed, publishedReports, verifiedReports, enrichedReports] =
    await Promise.all([
      getPaginatedFeed({
        scope: "ai-news",
        userId,
      }),
      prisma.newsArticle.count({
        where: { aiGenerated: true, published: true },
      }),
      prisma.newsArticle.count({
        where: {
          aiGenerated: true,
          published: true,
          factScore: { not: null },
        },
      }),
      prisma.newsArticle.count({
        where: {
          aiGenerated: true,
          published: true,
          OR: [
            { summary: { not: null } },
            { sentiment: { not: null } },
            { aiTags: { not: null } },
          ],
        },
      }),
    ])

  return (
    <>
      <Header />
      <main className="public-page-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40, borderBottom: "1px solid var(--border)", paddingBottom: 20 }}>
          <h1 className="public-page-title" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(24px, 5vw, 48px)",
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

        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}>
          {[
            ["Published Reports", publishedReports],
            ["Verified Reports", verifiedReports],
            ["AI Context Ready", enrichedReports],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "16px 18px",
              }}
            >
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}>
                {label}
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 26,
                fontWeight: 800,
                color: "var(--accent)",
              }}>
                {value}
              </div>
            </div>
          ))}
        </section>

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

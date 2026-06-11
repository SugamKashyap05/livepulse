import Header from "@/components/Header"
import DigestClient from "@/components/DigestClient"
import { getArticleLink } from "@/lib/articleLinks"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function DigestPage() {
  const today = new Date().toISOString().slice(0, 10)

  const existing = await prisma.dailyDigest.findUnique({
    where: { date: today },
  })

  const topArticles = await prisma.newsArticle.findMany({
    where: { published: true },
    orderBy: { pubDate: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      source: true,
      topic: true,
      link: true,
      aiGenerated: true,
    },
  })

  return (
    <>
      <Header />
      <main className="public-page-shell" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "2px",
            color: "var(--accent)",
            textTransform: "uppercase",
            marginBottom: 10,
          }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 className="public-page-title" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 40,
            fontWeight: 900,
            color: "var(--text)",
            margin: 0,
            lineHeight: 1.2,
          }}>
            Daily Briefing
          </h1>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 8,
          }}>
            AI-generated summary of today&apos;s top news
          </p>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 8,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
          }}>
            Published public coverage only
          </p>
        </div>

        {/* Top headlines sidebar */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "16px 20px",
          marginBottom: 28,
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 12,
          }}>
            Today&apos;s Top Headlines
          </div>
          {topArticles.map((a, i) => (
            <a
              key={i}
              href={getArticleLink(a)}
              style={{
                display: "flex",
                gap: 12,
                padding: "8px 0",
                borderBottom: i < topArticles.length - 1
                  ? "1px solid var(--border)"
                  : "none",
                textDecoration: "none",
                alignItems: "flex-start",
              }}
            >
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "var(--accent)",
                minWidth: 16,
                marginTop: 2,
              }}>
                {i + 1}
              </span>
              <div>
                <div style={{
                  fontSize: 13,
                  color: "var(--text)",
                  lineHeight: 1.4,
                  marginBottom: 2,
                }}>
                  {a.title}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--muted)",
                }}>
                  {a.source}
                </div>
              </div>
            </a>
          ))}
          {topArticles.length === 0 && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--muted)",
              padding: "10px 0",
            }}>
              No published headlines are available yet.
            </div>
          )}
        </div>

        <DigestClient initialDigest={existing?.content || null} />
      </main>
    </>
  )
}

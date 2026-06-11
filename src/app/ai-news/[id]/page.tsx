import { notFound } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import ArticleAiPanel from "@/components/ArticleAiPanel"
import Header from "@/components/Header"
import NewsCard from "@/components/NewsCard"
import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getArticleLink } from "@/lib/articleLinks"
import { getRelatedArticles } from "@/lib/relatedArticles"

export const dynamic = "force-dynamic"

type AiReportPageProps = {
  params: Promise<{ id: string }>
}

export default async function AiReportPage({ params }: AiReportPageProps) {
  const { id } = await params

  const article = await prisma.newsArticle.findFirst({
    where: {
      id,
      aiGenerated: true,
      published: true,
    },
  })

  if (!article) notFound()

  const userId = await getCurrentUserId()
  const related = await getRelatedArticles({
    articleId: article.id,
    userId,
    limit: 4,
  })

  const publishedAt = formatDistanceToNow(new Date(article.pubDate), {
    addSuffix: true,
  })

  return (
    <>
      <Header />
      <main
        className="article-detail-shell"
        style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px 80px" }}
      >
        <article>
          <div style={{
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}>
            <span style={{
              color: "#000",
              background: "var(--accent)",
              padding: "3px 8px",
              borderRadius: 2,
              fontWeight: 800,
            }}>
              AI Generated
            </span>
            <span>{article.topic}</span>
            <span>{publishedAt}</span>
            <span>{article.source}</span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(24px, 5vw, 48px)",
            lineHeight: 1.05,
            fontWeight: 900,
            margin: "0 0 22px",
            color: "var(--text)",
          }}>
            {article.title}
          </h1>

          {article.image && (
            <div style={{
              width: "100%",
              aspectRatio: "16 / 9",
              marginBottom: 28,
              overflow: "hidden",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--surface)",
            }}>
              <img
                className="article-detail-image"
                src={article.image}
                alt={article.title}
                loading="eager"
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}

          <div style={{
            fontSize: 17,
            lineHeight: 1.8,
            color: "var(--text)",
            whiteSpace: "pre-line",
          }}>
            {article.description || article.summary || "This AI report has no body text yet."}
          </div>

          {(article.factScore !== null || article.biasAnalysis) && (
            <div style={{
              marginTop: 32,
              padding: "16px 20px",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              <div style={{
                fontSize: 9,
                color: "var(--muted)",
                letterSpacing: "1px",
                marginBottom: 12,
              }}>
                AGENT ANALYSIS
              </div>

              {article.factScore !== null && (
                <div style={{
                  color: article.factScore >= 80
                    ? "#4af0c4"
                    : article.factScore >= 60
                      ? "#f5c542"
                      : "#ff4d4d",
                  fontSize: 13,
                  marginBottom: 8,
                }}>
                  FACT SCORE: {article.factScore}/100
                </div>
              )}

              {article.biasAnalysis && (
                <div style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  lineHeight: 1.6,
                }}>
                  BIAS ANALYSIS: {article.biasAnalysis}
                </div>
              )}
            </div>
          )}
        </article>

        <div style={{ marginTop: 36 }}>
          <ArticleAiPanel
            article={{
              id: article.id,
              title: article.title,
              description: article.description || article.summary || "",
              topic: article.topic,
              summary: article.summary,
              sentiment: article.sentiment,
              aiTags: article.aiTags,
            }}
          />
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h3 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              color: "var(--muted)",
              marginBottom: 16,
            }}>
              RELATED COVERAGE
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}>
              {related.map(({ article: item, reason }) => (
                <div key={item.id} style={{ display: "grid", gap: 8 }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    color: "var(--accent)",
                    letterSpacing: "0.7px",
                    textTransform: "uppercase",
                  }}>
                    {reason}
                  </div>
                  <NewsCard
                    item={{
                      id: item.id,
                      title: item.title,
                      description: item.description || "",
                      link: getArticleLink(item),
                      pubDate: formatDistanceToNow(new Date(item.pubDate), {
                        addSuffix: true,
                      }),
                      source: item.source,
                      topic: item.topic,
                      image: item.image || undefined,
                      summary: item.summary || undefined,
                      sentiment: item.sentiment || undefined,
                      aiTags: item.aiTags || undefined,
                      aiGenerated: item.aiGenerated,
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}

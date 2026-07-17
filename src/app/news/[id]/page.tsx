/* eslint-disable @next/next/no-img-element */
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import ArticleDwellTracker from "@/components/ArticleDwellTracker"
import ArticleAiPanel from "@/components/ArticleAiPanel"
import Header from "@/components/Header"
import NewsCard from "@/components/NewsCard"
import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getArticleLink } from "@/lib/articleLinks"
import { getRelatedArticles } from "@/lib/relatedArticles"

export const dynamic = "force-dynamic"

type ArticleDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ArticleDetailPage({
  params,
}: ArticleDetailPageProps) {
  const { id } = await params

  const article = await prisma.newsArticle.findFirst({
    where: { id, published: true },
  })

  if (!article) notFound()

  const userId = await getCurrentUserId()
  const related = await getRelatedArticles({
    articleId: article.id,
    userId,
    limit: 4,
  })

  return (
    <>
      <Header />
      <ArticleDwellTracker
        articleId={article.id}
        topic={article.topic}
        source={article.source}
        surface="article"
      />
      <main style={{ minHeight: "100dvh" }}>
        <div className="article-detail-shell" style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "clamp(24px, 4vw, 48px) clamp(16px, 3vw, 24px)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "1px",
            color: "var(--muted)",
            marginBottom: 32,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}>
            <Link href="/">Home</Link>
            <span style={{ color: "var(--border2)" }}>{">"}</span>
            <a
              href={`/topic/${article.topic}`}
              style={{ textTransform: "uppercase" }}
            >
              {article.topic}
            </a>
            <span style={{ color: "var(--border2)" }}>{">"}</span>
            <span style={{ color: "var(--muted2)" }}>Article</span>
          </div>

          <article>
            <div style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
            }}>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "1.5px",
                color: "var(--accent)",
                textTransform: "uppercase",
                padding: "3px 10px",
                border: "1px solid var(--border-accent)",
                background: "var(--accent-dim)",
                borderRadius: 3,
              }}>
                {article.source}
              </span>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--muted)",
              }}>
                {new Date(article.pubDate).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              {article.description && (
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--muted)",
                }}>
                  {article.description.split(/\s+/).filter(Boolean).length} words
                </span>
              )}
              {article.aiGenerated && (
                <span style={{
                  color: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "1px",
                }}>
                  AI GENERATED
                </span>
              )}
            </div>

            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3.5vw, 38px)",
              fontWeight: 900,
              lineHeight: 1.2,
              color: "var(--text)",
              marginBottom: 32,
              letterSpacing: "-0.3px",
            }}>
              {article.title}
            </h1>

            {article.image && (
              <div className="article-hero-image" style={{
                borderRadius: 6,
                overflow: "hidden",
                marginBottom: 32,
                border: "1px solid var(--border)",
                position: "relative",
                width: "100%",
                height: "clamp(200px, 45vw, 400px)",
              }}>
                <Image
                  className="article-detail-image object-cover"
                  src={article.image ?? '/placeholder-news.jpg'}
                  alt={article.title}
                  fill
                  priority
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  style={{
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            )}

            {article.description && (
              <div className="article-analysis-grid" style={{
                fontFamily: "var(--font-body)",
                fontSize: 17,
                lineHeight: 1.85,
                color: "var(--text)",
                marginBottom: 32,
                paddingLeft: 20,
                borderLeft: "3px solid var(--border2)",
              }}>
                {article.description}
              </div>
            )}

            <hr className="divider" />

            <ArticleAiPanel
              article={{
                id: article.id,
                title: article.title,
                description: article.description || "",
                topic: article.topic,
                summary: article.summary,
                sentiment: article.sentiment,
                aiTags: article.aiTags,
              }}
            />

            {article.aiGenerated && (article.factScore !== null || article.biasAnalysis) && (
              <div className="agent-analysis-grid" style={{
                padding: "16px 20px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 32,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 20,
              }}>
                {article.factScore !== null && (
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>
                      Fact Score
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 28,
                      fontWeight: 600,
                      color: article.factScore >= 80
                        ? "var(--positive)"
                        : article.factScore >= 60
                          ? "var(--gold)"
                          : "var(--negative)",
                    }}>
                      {article.factScore}
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>
                        /100
                      </span>
                    </div>
                  </div>
                )}
                {article.biasAnalysis && (
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>
                      Bias Analysis
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: "var(--text-dim)",
                    }}>
                      {article.biasAnalysis}
                    </div>
                  </div>
                )}
              </div>
            )}

            <a
              className="article-cta-btn"
              href={article.aiGenerated ? `/ai-news/${article.id}` : article.link}
              target={article.aiGenerated ? undefined : "_blank"}
              rel={article.aiGenerated ? undefined : "noopener noreferrer"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "var(--surface)",
                border: "1px solid var(--border2)",
                borderRadius: 6,
                marginBottom: 48,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--text-dim)",
                letterSpacing: "0.5px",
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              <span>
                {article.aiGenerated
                  ? "Read full AI report"
                  : `Read full article at ${article.source}`}
              </span>
              <span style={{ fontSize: 16 }}>→</span>
            </a>
          </article>

          {related.length > 0 && (
            <section>
              <div className="label" style={{
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
              }}>
                Related Coverage
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}>
                {related.map(({ article: item, reason }, index) => (
                  <div key={item.id} style={{ display: "grid", gap: 8 }}>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--accent)",
                      letterSpacing: "0.7px",
                      textTransform: "uppercase",
                    }}>
                      {reason}
                    </div>
                    <NewsCard
                      feedContext={{ scope: "related", surface: "related-article" }}
                      feedPosition={index}
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
                        isRead: false,
                        isBookmarked: false,
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}

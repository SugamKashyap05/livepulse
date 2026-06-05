"use client"

import { useState } from "react"
import { NewsItem } from "@/types/news"
import { getInternalArticleLink } from "@/lib/articleLinks"

const TOPIC_COLORS: Record<string, string> = {
  World: "#6c8fff",
  Technology: "#6c8fff",
  India: "#f97316",
  Business: "#f5c542",
  Science: "#a78bfa",
  Sports: "#f472b6",
  world: "#6c8fff",
  technology: "#6c8fff",
  india: "#f97316",
  business: "#f5c542",
  science: "#a78bfa",
  sports: "#f472b6",
  health: "#34d399",
  climate: "#22c55e",
  politics: "#fb7185",
}

const TOPIC_BG: Record<string, string> = {
  World: "rgba(108,143,255,0.06)",
  Technology: "rgba(108,143,255,0.06)",
  India: "rgba(249,115,22,0.06)",
  Business: "rgba(245,197,66,0.06)",
  Science: "rgba(167,139,250,0.06)",
  Sports: "rgba(244,114,182,0.06)",
  world: "rgba(108,143,255,0.06)",
  technology: "rgba(108,143,255,0.06)",
  india: "rgba(249,115,22,0.06)",
  business: "rgba(245,197,66,0.06)",
  science: "rgba(167,139,250,0.06)",
  sports: "rgba(244,114,182,0.06)",
  health: "rgba(52,211,153,0.06)",
  climate: "rgba(34,197,94,0.06)",
  politics: "rgba(251,113,133,0.06)",
}

const SENTIMENT_CONFIG = {
  positive: { color: "var(--positive)", label: "Positive" },
  negative: { color: "var(--negative)", label: "Negative" },
  neutral: { color: "var(--neutral)", label: "Neutral" },
}

export interface NewsItemWithAI extends NewsItem {
  summary?: string
  sentiment?: string
  aiTags?: string
  aiGenerated?: boolean
  isRead?: boolean
  isBookmarked?: boolean
}

export default function NewsCard({ item }: { item: NewsItemWithAI }) {
  const color = TOPIC_COLORS[item.topic] || "var(--muted)"
  const bg = TOPIC_BG[item.topic] || "var(--surface2)"
  const articleHref = getInternalArticleLink(item)

  const [summary, setSummary] = useState<string | null>(item.summary || null)
  const [sentiment, setSentiment] = useState<string | null>(item.sentiment || null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [loadingTags, setLoadingTags] = useState(false)
  const [bookmarked, setBookmarked] = useState<boolean>(item.isBookmarked ?? false)
  const [showSummary, setShowSummary] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [aiTags, setAiTags] = useState<string[]>(() => {
    try {
      return item.aiTags ? JSON.parse(item.aiTags) : []
    } catch {
      return []
    }
  })

  async function handleSummarize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (summary) {
      setShowSummary((v) => !v)
      return
    }

    setLoadingSummary(true)
    setAiError(null)
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          description: item.description,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAiError("AI service is unavailable right now.")
        return
      }
      if (data.summary) {
        setSummary(data.summary)
        setShowSummary(true)
      }
    } catch {
      setAiError("AI service is unavailable right now.")
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleSentiment(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (sentiment) return

    setLoadingSentiment(true)
    setAiError(null)
    try {
      const res = await fetch("/api/ai/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          description: item.description,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAiError("AI service is unavailable right now.")
        return
      }
      if (data.sentiment) setSentiment(data.sentiment)
    } catch {
      setAiError("AI service is unavailable right now.")
    } finally {
      setLoadingSentiment(false)
    }
  }

  async function handleGenerateTags(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (aiTags.length > 0 || loadingTags) return

    setLoadingTags(true)
    setAiError(null)
    try {
      const res = await fetch("/api/ai/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          description: item.description,
          topic: item.topic,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setAiError("AI service is unavailable right now.")
        return
      }
      if (Array.isArray(data.tags)) {
        setAiTags(data.tags)
      }
    } catch {
      setAiError("AI service is unavailable right now.")
    } finally {
      setLoadingTags(false)
    }
  }

  async function handleBookmark(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const method = bookmarked ? "DELETE" : "POST"
    try {
      const response = await fetch("/api/user/bookmarks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: item.id }),
      })

      if (response.ok) {
        setBookmarked((value) => !value)
      }
    } catch {
      // Bookmarking is user-only; logged-out or transient failures should not break the card.
    }
  }

  function handleArticleOpen() {
    fetch("/api/user/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: item.id }),
    }).catch(() => {})
  }

  const sentimentCfg =
    SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
        cursor: "pointer",
        opacity: item.isRead ? 0.55 : 1,
        position: "relative",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = "var(--border2)"
        event.currentTarget.style.transform = "translateY(-2px)"
        event.currentTarget.style.boxShadow = "var(--shadow-md)"
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "var(--border)"
        event.currentTarget.style.transform = "translateY(0)"
        event.currentTarget.style.boxShadow = "none"
      }}
    >
      {item.aiGenerated && (
        <div style={{
          height: 2,
          background: "linear-gradient(90deg, var(--accent), transparent)",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
        }} />
      )}

      <div style={{
        position: "relative",
        height: 180,
        overflow: "hidden",
        background: "var(--surface2)",
      }}>
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.4s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.transform = "scale(1.03)"
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "scale(1)"
            }}
            onError={(event) => {
              const wrapper = (event.currentTarget as HTMLElement).parentElement
              if (wrapper) {
                wrapper.style.background = bg
                wrapper.style.display = "flex"
                wrapper.style.alignItems = "center"
                wrapper.style.justifyContent = "center"
                wrapper.style.height = "180px"
                const existing = wrapper.querySelector("[data-src-label]")
                if (!existing) {
                  const span = document.createElement("span")
                  span.setAttribute("data-src-label", "true")
                  span.style.cssText = [
                    "font-family:'IBM Plex Mono',monospace",
                    "font-size:11px",
                    "letter-spacing:1px",
                    `color:${color}`,
                    "text-transform:uppercase",
                    "opacity:0.7",
                  ].join(";")
                  span.textContent = item.source
                  wrapper.appendChild(span)
                }
              }
            }}
          />
        ) : (
          <div style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: bg,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "2px",
              color: "var(--muted2)",
              textTransform: "uppercase",
            }}>
              {item.source}
            </span>
          </div>
        )}

        {sentiment && sentimentCfg && (
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(9,9,12,0.85)",
            backdropFilter: "blur(8px)",
            border: `1px solid ${sentimentCfg.color}40`,
            borderRadius: 3,
            padding: "3px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1px",
            color: sentimentCfg.color,
          }}>
            {sentimentCfg.label}
          </div>
        )}

        {item.aiGenerated && (
          <div style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(9,9,12,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--border-accent)",
            borderRadius: 3,
            padding: "3px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1px",
            color: "var(--accent)",
          }}>
            AI
          </div>
        )}
      </div>

      <div style={{
        padding: "16px 18px",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}>
            {item.source}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--accent)",
            padding: "2px 7px",
            border: "1px solid var(--border-accent)",
            borderRadius: 2,
          }}>
            {item.topic}
          </span>
        </div>

        <a
          href={articleHref}
          onClick={handleArticleOpen}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 17,
            fontWeight: 700,
            lineHeight: 1.35,
            color: "var(--text)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = "var(--accent)"
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = "var(--text)"
          }}
        >
          {item.title}
        </a>

        {item.description && !showSummary && (
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.6,
            color: "var(--text-dim)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {item.description}
          </p>
        )}

        {aiTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {aiTags.slice(0, 4).map((tag) => (
              <a
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                onClick={(event) => event.stopPropagation()}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  padding: "2px 7px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  color: "var(--muted)",
                  letterSpacing: "0.5px",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = "var(--border-accent)"
                  event.currentTarget.style.color = "var(--accent)"
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = "var(--border)"
                  event.currentTarget.style.color = "var(--muted)"
                }}
              >
                #{tag}
              </a>
            ))}
          </div>
        )}

        {showSummary && summary && (
          <div style={{
            padding: "10px 14px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderLeft: "2px solid var(--accent)",
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.7,
            color: "var(--text-dim)",
            whiteSpace: "pre-wrap",
          }}>
            {summary}
          </div>
        )}

        {aiError && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--negative)",
            padding: "6px 10px",
            background: "rgba(245,101,101,0.06)",
            border: "1px solid rgba(245,101,101,0.2)",
            borderRadius: 3,
          }}>
            {aiError}
          </div>
        )}
      </div>

      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "10px 18px",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--muted)",
          flex: 1,
        }}>
          {item.pubDate}
          {item.isRead && (
            <span style={{ marginLeft: 8, color: "var(--muted2)" }}>
              · READ
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={handleBookmark}
          title={bookmarked ? "Remove bookmark" : "Bookmark"}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1,
            padding: "4px 8px",
            background: "transparent",
            color: bookmarked ? "var(--accent)" : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 2,
          }}
        >
          {bookmarked ? "★" : "☆"}
        </button>

        {aiTags.length === 0 && (
          <button
            onClick={handleGenerateTags}
            disabled={loadingTags}
            title="Generate AI tags"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.5px",
              padding: "4px 8px",
              background: "transparent",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              cursor: loadingTags ? "not-allowed" : "pointer",
            }}
          >
            {loadingTags ? "..." : "tags"}
          </button>
        )}

        <button
          onClick={handleSentiment}
          disabled={loadingSentiment || !!sentiment}
          title="Analyze sentiment"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.5px",
            padding: "4px 8px",
            background: "transparent",
            color: sentiment
              ? SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]?.color || "var(--muted)"
              : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            cursor: sentiment || loadingSentiment ? "default" : "pointer",
          }}
        >
          {loadingSentiment ? "..." : sentiment ? "✓" : "mood"}
        </button>

        <button
          onClick={handleSummarize}
          disabled={loadingSummary}
          title="AI summarize"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.5px",
            padding: "4px 8px",
            background: showSummary ? "var(--accent-dim)" : "transparent",
            color: showSummary ? "var(--accent)" : "var(--muted)",
            border: `1px solid ${showSummary ? "var(--border-accent)" : "var(--border)"}`,
            borderRadius: 2,
            cursor: loadingSummary ? "not-allowed" : "pointer",
          }}
        >
          {loadingSummary ? "..." : summary ? (showSummary ? "hide" : "summary") : "AI"}
        </button>
      </div>
    </article>
  )
}

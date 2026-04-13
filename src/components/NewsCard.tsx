"use client"

import { useState } from "react"
import { NewsItem } from "@/types/news"

const TOPIC_COLORS: Record<string, string> = {
  World: "#6c8fff",
  Technology: "#4af0c4",
  India: "#f97316",
  Business: "#f5c542",
  Science: "#a78bfa",
  Sports: "#f472b6",
}

const TOPIC_BG: Record<string, string> = {
  World: "rgba(108,143,255,0.06)",
  Technology: "rgba(74,240,196,0.06)",
  India: "rgba(249,115,22,0.06)",
  Business: "rgba(245,197,66,0.06)",
  Science: "rgba(167,139,250,0.06)",
  Sports: "rgba(244,114,182,0.06)",
}

const SENTIMENT_CONFIG = {
  positive: { color: "#4af0c4", label: "▲ Positive" },
  negative: { color: "#ff4d4d", label: "▼ Negative" },
  neutral:  { color: "#7a7d8a", label: "● Neutral" },
}

export interface NewsItemWithAI extends NewsItem {
  summary?: string
  sentiment?: string
  aiTags?: string
}

export default function NewsCard({ item }: { item: NewsItemWithAI }) {
  const color = TOPIC_COLORS[item.topic] || "#6b6e7d"
  const bg = TOPIC_BG[item.topic] || "rgba(255,255,255,0.03)"

  const [summary, setSummary] = useState<string | null>(item.summary || null)
  const [sentiment, setSentiment] = useState<string | null>(item.sentiment || null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const aiTags: string[] = (() => {
    try {
      return item.aiTags ? JSON.parse(item.aiTags) : []
    } catch {
      return []
    }
  })()

  async function handleSummarize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (summary) {
      setShowSummary((v) => !v)
      return
    }

    setLoadingSummary(true)
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
      if (data.summary) {
        setSummary(data.summary)
        setShowSummary(true)
      }
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleSentiment(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (sentiment) return

    setLoadingSentiment(true)
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
      if (data.sentiment) setSentiment(data.sentiment)
    } finally {
      setLoadingSentiment(false)
    }
  }

  const sentimentCfg =
    SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
        transition: "border-color 0.2s, transform 0.15s",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = color
        el.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = "var(--border)"
        el.style.transform = "translateY(0)"
      }}
    >
      {/* Image or placeholder */}
      {item.image ? (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", width: "100%", height: 180, overflow: "hidden", flexShrink: 0 }}
        >
          <img
            src={item.image}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => {
              const wrapper = (e.currentTarget as HTMLElement).parentElement
              if (wrapper) {
                wrapper.style.background = bg
                wrapper.style.display = "flex"
                wrapper.style.alignItems = "center"
                wrapper.style.justifyContent = "center"
                wrapper.style.height = "120px"
                wrapper.innerHTML = `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:1px;color:${color};text-transform:uppercase;opacity:0.7">${item.source}</span>`
              }
            }}
          />
        </a>
      ) : (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            width: "100%",
            height: 90,
            flexShrink: 0,
            background: bg,
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid var(--border)",
            textDecoration: "none",
          }}
        >
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1.5px",
            color,
            textTransform: "uppercase",
            opacity: 0.7,
          }}>
            {item.source}
          </span>
        </a>
      )}

      <div style={{
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
      }}>
        {/* Topic + time + sentiment */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>
          <span style={{
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: "1px",
            color,
            textTransform: "uppercase",
            fontWeight: 500,
          }}>
            {item.topic}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sentimentCfg && (
              <span style={{
                fontSize: 9,
                fontFamily: "'IBM Plex Mono', monospace",
                color: sentimentCfg.color,
                letterSpacing: "0.5px",
              }}>
                {sentimentCfg.label}
              </span>
            )}
            <span style={{
              fontSize: 10,
              fontFamily: "'IBM Plex Mono', monospace",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}>
              {item.pubDate}
            </span>
          </div>
        </div>

        {/* Title */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <h2 style={{
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.45,
            color: "var(--text)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {item.title}
          </h2>
        </a>

        {/* Description */}
        {item.description && !showSummary && (
          <p style={{
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.6,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {item.description}
          </p>
        )}

        {/* AI Summary */}
        {showSummary && summary && (
          <div style={{
            background: "rgba(74,240,196,0.05)",
            border: "1px solid rgba(74,240,196,0.15)",
            borderRadius: 4,
            padding: "10px 12px",
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              color: "var(--accent)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
              AI Summary
            </div>
            <div style={{
              fontSize: 12,
              color: "var(--text)",
              lineHeight: 1.7,
              whiteSpace: "pre-line",
            }}>
              {summary}
            </div>
          </div>
        )}

        {/* AI Tags */}
        {aiTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {aiTags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.5px",
                  padding: "2px 7px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  color: "var(--muted)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: "auto",
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "var(--muted)",
          }}>
            {item.source}
          </span>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleSentiment}
              disabled={loadingSentiment || !!sentiment}
              title="Analyze sentiment"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.5px",
                padding: "3px 8px",
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
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.5px",
                padding: "3px 8px",
                background: showSummary
                  ? "rgba(74,240,196,0.1)"
                  : "transparent",
                color: showSummary ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${showSummary ? "rgba(74,240,196,0.3)" : "var(--border)"}`,
                borderRadius: 2,
                cursor: loadingSummary ? "not-allowed" : "pointer",
              }}
            >
              {loadingSummary ? "..." : summary ? (showSummary ? "hide" : "summary") : "AI ✦"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

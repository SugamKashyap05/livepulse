"use client"

import type { CSSProperties, FormEvent } from "react"
import { useState } from "react"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type ArticleAiPanelProps = {
  article: {
    id: string
    title: string
    description: string
    topic: string
    summary: string | null
    sentiment: string | null
    aiTags: string | null
  }
}

const SENTIMENT_CONFIG = {
  positive: { color: "#4af0c4", label: "Positive", tone: "Constructive tone" },
  negative: { color: "#ff4d4d", label: "Negative", tone: "Risk-heavy tone" },
  neutral: { color: "var(--muted)", label: "Neutral", tone: "Straight report" },
}

const SUGGESTED_QUESTIONS = [
  "What are the key facts?",
  "Why does this matter?",
  "What should I watch next?",
]

function parseTags(aiTags: string | null) {
  try {
    const tags = aiTags ? JSON.parse(aiTags) : []
    return Array.isArray(tags) ? tags.map(String) : []
  } catch {
    return []
  }
}

function splitSummary(summary: string) {
  return summary
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
}

export default function ArticleAiPanel({ article }: ArticleAiPanelProps) {
  const [summary, setSummary] = useState<string | null>(article.summary)
  const [sentiment, setSentiment] = useState<string | null>(article.sentiment)
  const [tags, setTags] = useState<string[]>(() => parseTags(article.aiTags))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [loadingTags, setLoadingTags] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentimentConfig =
    SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]
  const summaryLines = summary ? splitSummary(summary) : []

  async function handleSummarize(force = false) {
    if ((summary && !force) || loadingSummary) return

    setLoadingSummary(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: article.id,
          title: article.title,
          description: article.description,
          force,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (data.summary) setSummary(data.summary)
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleSentiment() {
    if (sentiment || loadingSentiment) return

    setLoadingSentiment(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: article.id,
          title: article.title,
          description: article.description,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (data.sentiment) setSentiment(data.sentiment)
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setLoadingSentiment(false)
    }
  }

  async function handleTags() {
    if (tags.length > 0 || loadingTags) return

    setLoadingTags(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: article.id,
          title: article.title,
          description: article.description,
          topic: article.topic,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (Array.isArray(data.tags)) setTags(data.tags.map(String))
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setLoadingTags(false)
    }
  }

  async function askArticle(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || isTyping) return

    const nextMessages: ChatMessage[] = [
      ...messages.slice(-11),
      { role: "user", content: cleanQuestion },
    ]

    setMessages(nextMessages)
    setChatInput("")
    setIsTyping(true)
    setError(null)

    try {
      const res = await fetch("/api/ai/article-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          messages: nextMessages.slice(-12),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (data.reply) {
        setMessages((prev) => [
          ...prev.slice(-11),
          { role: "assistant", content: data.reply },
        ])
      }
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setIsTyping(false)
    }
  }

  function handleAsk(e: FormEvent) {
    e.preventDefault()
    askArticle(chatInput)
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ARTICLE AI</div>
          <h2 style={headingStyle}>Reader briefing</h2>
          <p style={subheadStyle}>
            Get the useful version: key facts, mood, tags, and a focused chat
            that only uses this article excerpt.
          </p>
        </div>
        <div style={statusGridStyle}>
          <StatusPill label="Summary" value={summary ? "Ready" : "Missing"} />
          <StatusPill label="Mood" value={sentimentConfig?.label || "Missing"} />
          <StatusPill label="Tags" value={tags.length ? String(tags.length) : "Missing"} />
        </div>
      </div>

      <div style={summaryCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={labelStyle}>AI SUMMARY</div>
            <div style={sectionTitleStyle}>What this story says</div>
          </div>
          <button
            type="button"
            onClick={() => handleSummarize(Boolean(summary))}
            disabled={loadingSummary}
            style={primaryButtonStyle}
          >
            {loadingSummary
              ? "BUILDING BRIEF..."
              : summary
                ? "EXPAND BRIEFING"
                : "GENERATE BRIEFING"}
          </button>
        </div>

        {summaryLines.length > 0 ? (
          <div style={summaryListStyle}>
            {summaryLines.map((line, index) => (
              <div key={`${line}-${index}`} style={summaryItemStyle}>
                <span style={summaryNumberStyle}>{String(index + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptySummaryStyle}>
            Build a richer AI briefing with key facts, context, and why it
            matters. It stays based on the syndicated excerpt.
          </div>
        )}
      </div>

      <div style={insightGridStyle}>
        <div style={miniPanelStyle}>
          <div style={labelStyle}>MOOD</div>
          {sentimentConfig ? (
            <>
              <div style={{ ...metricStyle, color: sentimentConfig.color }}>
                {sentimentConfig.label}
              </div>
              <div style={helperTextStyle}>{sentimentConfig.tone}</div>
            </>
          ) : (
            <>
              <div style={helperTextStyle}>
                Detect whether the report reads positive, neutral, or negative.
              </div>
              <button
                type="button"
                onClick={handleSentiment}
                disabled={loadingSentiment}
                style={secondaryButtonStyle}
              >
                {loadingSentiment ? "ANALYSING..." : "ANALYZE MOOD"}
              </button>
            </>
          )}
        </div>

        <div style={miniPanelStyle}>
          <div style={labelStyle}>TOPIC TAGS</div>
          {tags.length > 0 ? (
            <div style={tagWrapStyle}>
              {tags.map((tag) => (
                <a
                  key={tag}
                  href={`/tag/${encodeURIComponent(tag)}`}
                  style={tagStyle}
                >
                  #{tag}
                </a>
              ))}
            </div>
          ) : (
            <>
              <div style={helperTextStyle}>
                Generate searchable tags to connect this story with related coverage.
              </div>
              <button
                type="button"
                onClick={handleTags}
                disabled={loadingTags}
                style={secondaryButtonStyle}
              >
                {loadingTags ? "GENERATING..." : "GENERATE TAGS"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={chatCardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={labelStyle}>ASK ABOUT THIS ARTICLE</div>
            <div style={sectionTitleStyle}>Article-aware chat</div>
          </div>
          {isTyping && <span style={typingStyle}>thinking...</span>}
        </div>

        {messages.length === 0 && (
          <div style={suggestionWrapStyle}>
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => askArticle(question)}
                disabled={isTyping}
                style={suggestionStyle}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div style={messageListStyle}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  ...messageStyle,
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  background: message.role === "user"
                    ? "rgba(74,240,196,0.1)"
                    : "var(--surface)",
                  borderColor: message.role === "user"
                    ? "rgba(74,240,196,0.25)"
                    : "var(--border)",
                  color: message.role === "user" ? "var(--text)" : "var(--muted)",
                }}
              >
                {message.content}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAsk} style={chatFormStyle}>
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask what changed, why it matters, or what to watch next..."
            style={chatInputStyle}
          />
          <button
            type="submit"
            disabled={isTyping || !chatInput.trim()}
            style={primaryButtonStyle}
          >
            ASK
          </button>
        </form>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
    </section>
  )
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={statusPillStyle}>
      <span style={statusLabelStyle}>{label}</span>
      <span style={statusValueStyle}>{value}</span>
    </div>
  )
}

const panelStyle: CSSProperties = {
  marginBottom: 36,
  padding: 24,
  background: "linear-gradient(180deg, rgba(74,240,196,0.06), rgba(255,255,255,0.02))",
  border: "1px solid rgba(74,240,196,0.22)",
  borderRadius: 8,
  boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
}

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 18,
  alignItems: "start",
  marginBottom: 18,
}

const eyebrowStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  color: "var(--accent)",
  letterSpacing: "1.4px",
  marginBottom: 6,
}

const headingStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "'Playfair Display', serif",
  fontSize: 28,
  lineHeight: 1.15,
}

const subheadStyle: CSSProperties = {
  maxWidth: 620,
  margin: "8px 0 0",
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
}

const statusGridStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
}

const statusPillStyle: CSSProperties = {
  minWidth: 82,
  padding: "7px 9px",
  background: "rgba(0,0,0,0.18)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  fontFamily: "'IBM Plex Mono', monospace",
}

const statusLabelStyle: CSSProperties = {
  display: "block",
  color: "var(--muted)",
  fontSize: 8,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
}

const statusValueStyle: CSSProperties = {
  display: "block",
  color: "var(--text)",
  fontSize: 11,
  marginTop: 3,
}

const summaryCardStyle: CSSProperties = {
  padding: "18px 20px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 7,
  marginBottom: 14,
}

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  marginBottom: 14,
}

const labelStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 9,
  color: "var(--muted)",
  letterSpacing: "1.2px",
  textTransform: "uppercase",
}

const sectionTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 15,
  fontWeight: 700,
  marginTop: 3,
}

const summaryListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
}

const summaryItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: 12,
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.7,
}

const summaryNumberStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  paddingTop: 4,
}

const emptySummaryStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.7,
  borderLeft: "2px solid var(--accent)",
  paddingLeft: 12,
}

const insightGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  marginBottom: 14,
}

const miniPanelStyle: CSSProperties = {
  minHeight: 112,
  padding: "16px 18px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 7,
}

const metricStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 20,
  fontWeight: 700,
  marginTop: 8,
}

const helperTextStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.6,
  margin: "8px 0 12px",
}

const tagWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
  marginTop: 10,
}

const tagStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  padding: "5px 9px",
  background: "rgba(74,240,196,0.08)",
  border: "1px solid rgba(74,240,196,0.22)",
  borderRadius: 999,
  color: "var(--accent)",
  textDecoration: "none",
}

const chatCardStyle: CSSProperties = {
  padding: "18px 20px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 7,
}

const suggestionWrapStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 14,
}

const suggestionStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  color: "var(--text)",
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "7px 11px",
  cursor: "pointer",
}

const messageListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxHeight: 260,
  overflowY: "auto",
  marginBottom: 14,
}

const messageStyle: CSSProperties = {
  maxWidth: "86%",
  border: "1px solid var(--border)",
  borderRadius: 7,
  padding: "10px 12px",
  fontSize: 12,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
}

const typingStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
}

const chatFormStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
}

const chatInputStyle: CSSProperties = {
  minWidth: 0,
  border: "1px solid var(--border)",
  background: "var(--surface2)",
  color: "var(--text)",
  padding: "11px 12px",
  borderRadius: 5,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
}

const primaryButtonStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.7px",
  padding: "9px 12px",
  background: "var(--accent)",
  color: "#000",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 700,
  whiteSpace: "nowrap",
}

const secondaryButtonStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.5px",
  padding: "8px 10px",
  background: "transparent",
  color: "var(--accent)",
  border: "1px solid rgba(74,240,196,0.35)",
  borderRadius: 4,
  cursor: "pointer",
}

const errorStyle: CSSProperties = {
  marginTop: 12,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  color: "var(--red)",
}

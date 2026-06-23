"use client"

import type { CSSProperties, FormEvent, ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { trackContextEvent } from "@/lib/contextTelemetry"
import { useAuthGate, useSession } from "@/context/AuthGateContext"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type StreamEvent = {
  type?: string
  content?: string
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

function formatAIResponse(content: string): ReactNode {
  const lines = content.split("\n")
  const elements: ReactNode[] = []
  let bulletBuffer: string[] = []

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return
    elements.push(
      <ul key={`ul-${elements.length}`} style={formattedListStyle}>
        {bulletBuffer.map((item, index) => (
          <li key={index} style={formattedListItemStyle}>
            <span style={formattedBulletStyle}>◆</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const bulletMatch =
      trimmed.match(/^[*\-•]\s+(.+)/) ||
      trimmed.match(/^\d+\.\s+(.+)/)

    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1])
      continue
    }

    flushBullets()

    if (trimmed.length > 0) {
      const isLabel = trimmed.endsWith(":")
      elements.push(
        <p
          key={`p-${elements.length}`}
          style={{
            ...formattedParagraphStyle,
            color: isLabel ? "var(--text-dim)" : "var(--text)",
            fontWeight: isLabel ? 500 : 400,
            letterSpacing: isLabel ? "0.3px" : 0,
          }}
        >
          {trimmed}
        </p>
      )
    }
  }

  flushBullets()
  return <>{elements}</>
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
  const [isThinking, setIsThinking] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastTouchActivationAt = useRef(0)

  const { triggerAuthGate } = useAuthGate()
  const { hasSession } = useSession()

  const sentimentConfig =
    SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]
  const summaryLines = summary ? splitSummary(summary) : []

  function trackAiAction(action: string) {
    trackContextEvent({
      articleId: article.id,
      type: "ai_action",
      surface: "article-ai-panel",
      context: {
        action,
        topic: article.topic,
      },
    })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [messages, streamingContent])

  async function handleSummarize(force = false) {
    if ((summary && !force) || loadingSummary) return

    if (!hasSession) {
      triggerAuthGate('summarize')
      return
    }

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
      if (res.status === 401) {
        triggerAuthGate('summarize')
        return
      }
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (data.summary) {
        setSummary(data.summary)
        trackAiAction(force ? "expand_summary" : "summarize")
      }
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleSentiment() {
    if (sentiment || loadingSentiment) return

    if (!hasSession) {
      triggerAuthGate('sentiment')
      return
    }

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
      if (res.status === 401) {
        triggerAuthGate('sentiment')
        return
      }
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (data.sentiment) {
        setSentiment(data.sentiment)
        trackAiAction("sentiment")
      }
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setLoadingSentiment(false)
    }
  }

  async function handleTags() {
    if (tags.length > 0 || loadingTags) return

    if (!hasSession) {
      triggerAuthGate('tag')
      return
    }

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
      if (res.status === 401) {
        triggerAuthGate('tag')
        return
      }
      const data = await res.json()
      if (!res.ok || data.error) {
        setError("AI service is unavailable right now.")
        return
      }
      if (Array.isArray(data.tags)) {
        setTags(data.tags.map(String))
        trackAiAction("tags")
      }
    } catch {
      setError("AI service is unavailable right now.")
    } finally {
      setLoadingTags(false)
    }
  }

  async function askArticle(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || isTyping) return

    if (!hasSession) {
      triggerAuthGate('chat')
      return
    }

    const nextMessages: ChatMessage[] = [
      ...messages.slice(-11),
      { role: "user", content: cleanQuestion },
    ]

    setMessages(nextMessages)
    trackAiAction("article_chat")
    setChatInput("")
    setIsTyping(true)
    setIsThinking(true)
    setStreamingContent("")
    setError(null)

    try {
      const res = await fetch("/api/ai/article-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          topic: article.topic,
          messages: nextMessages.slice(-12),
        }),
      })

      if (res.status === 401) {
        triggerAuthGate('chat')
        return
      }

      if (!res.ok || !res.body) {
        throw new Error("Article chat failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const rawEvent of events) {
          const line = rawEvent
            .split("\n")
            .find((eventLine) => eventLine.startsWith("data: "))
          if (!line) continue

          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent

            if (event.type === "start") {
              setIsThinking(false)
            }

            if (event.type === "token" && typeof event.content === "string") {
              accumulated += event.content
              setStreamingContent(accumulated)
            }

            if (event.type === "done") {
              const finalContent =
                typeof event.content === "string" ? event.content : accumulated
              setStreamingContent("")
              setMessages((prev) => [
                ...prev.slice(-11),
                { role: "assistant", content: finalContent },
              ])
            }

            if (event.type === "error") {
              setStreamingContent("")
              setMessages((prev) => [
                ...prev.slice(-11),
                {
                  role: "assistant",
                  content:
                    event.content ||
                    "AI service unavailable. Check that Ollama is running.",
                },
              ])
            }
          } catch {
            // Ignore malformed SSE frames.
          }
        }
      }
    } catch {
      setStreamingContent("")
      setError("AI service is unavailable right now.")
    } finally {
      setIsTyping(false)
      setIsThinking(false)
      setStreamingContent("")
    }
  }

  function handleAsk(e: FormEvent) {
    e.preventDefault()
    askArticle(chatInput)
  }

  function shouldIgnoreFollowUpClick() {
    return Date.now() - lastTouchActivationAt.current < 700
  }

  function runFromTouch(
    event: React.TouchEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>,
    action: () => void | Promise<void>
  ) {
    if ("pointerType" in event && event.pointerType === "mouse") return
    event.preventDefault()
    event.stopPropagation()
    lastTouchActivationAt.current = Date.now()
    void action()
  }

  function runFromClick(action: () => void | Promise<void>) {
    if (shouldIgnoreFollowUpClick()) return
    void action()
  }

  return (
    <section className="article-ai-panel" style={panelStyle}>
      <div className="article-ai-header" style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ARTICLE AI</div>
          <h2 style={headingStyle}>Reader briefing</h2>
          <p style={subheadStyle}>
            Get the useful version: key facts, mood, tags, and a focused chat
            with related coverage and today&apos;s broader headlines.
          </p>
        </div>
        <div style={statusGridStyle}>
          <StatusPill label="Summary" value={summary ? "Ready" : "Missing"} />
          <StatusPill label="Mood" value={sentimentConfig?.label || "Missing"} />
          <StatusPill label="Tags" value={tags.length ? String(tags.length) : "Missing"} />
        </div>
      </div>

      <div style={summaryCardStyle}>
        <div className="article-ai-section-header" style={sectionHeaderStyle}>
          <div>
            <div style={labelStyle}>AI SUMMARY</div>
            <div style={sectionTitleStyle}>What this story says</div>
          </div>
          <button
            type="button"
            onClick={() => runFromClick(() => handleSummarize(Boolean(summary)))}
            onPointerUp={(event) => runFromTouch(event, () => handleSummarize(Boolean(summary)))}
            onTouchEnd={(event) => runFromTouch(event, () => handleSummarize(Boolean(summary)))}
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
                onClick={() => runFromClick(handleSentiment)}
                onPointerUp={(event) => runFromTouch(event, handleSentiment)}
                onTouchEnd={(event) => runFromTouch(event, handleSentiment)}
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
                onClick={() => runFromClick(handleTags)}
                onPointerUp={(event) => runFromTouch(event, handleTags)}
                onTouchEnd={(event) => runFromTouch(event, handleTags)}
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
        <div className="article-ai-section-header" style={sectionHeaderStyle}>
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
                onClick={() => runFromClick(() => askArticle(question))}
                onPointerUp={(event) => runFromTouch(event, () => askArticle(question))}
                onTouchEnd={(event) => runFromTouch(event, () => askArticle(question))}
                disabled={isTyping}
                style={suggestionStyle}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {(messages.length > 0 || isThinking || streamingContent) && (
          <div style={messageListStyle}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  ...messageStyle,
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: message.role === "user" ? "80%" : "86%",
                  padding: message.role === "user" ? "12px 16px" : "14px 18px",
                  background: message.role === "user"
                    ? "rgba(108, 143, 255, 0.1)"
                    : "var(--surface2)",
                  border: message.role === "user"
                    ? "1px solid rgba(108, 143, 255, 0.2)"
                    : "1px solid var(--border2)",
                  borderLeft: message.role === "user"
                    ? "1px solid rgba(108, 143, 255, 0.2)"
                    : "3px solid var(--accent)",
                  borderRadius: message.role === "user"
                    ? "8px 0 8px 8px"
                    : "0 8px 8px 8px",
                  color: "var(--text)",
                }}
              >
                {message.role === "assistant"
                  ? formatAIResponse(message.content)
                  : message.content}
              </div>
            ))}

            {isThinking && (
              <div style={thinkingRowStyle}>
                <div style={thinkingBubbleStyle}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        ...thinkingDotStyle,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                  <span style={thinkingTextStyle}>processing query...</span>
                </div>
              </div>
            )}

            {streamingContent && (
              <div style={streamingBubbleStyle}>
                {formatAIResponse(streamingContent)}
                <span style={streamingCursorStyle} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        <form
          className="article-ai-chat-form"
          onSubmit={handleAsk}
          style={chatFormStyle}
          onFocus={(event) => {
            event.currentTarget.style.border = "1px solid rgba(108,143,255,0.4)"
            event.currentTarget.style.background = "var(--surface)"
          }}
          onBlur={(event) => {
            event.currentTarget.style.border = "1px solid var(--border2)"
            event.currentTarget.style.background = "var(--surface2)"
          }}
        >
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onFocus={(event) => {
              event.currentTarget.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              })
            }}
            placeholder="Ask what changed, why it matters, or what to watch next..."
            style={chatInputStyle}
          />
          <button
            type="submit"
            disabled={isTyping || !chatInput.trim()}
            onPointerUp={(event) => runFromTouch(event, () => askArticle(chatInput))}
            onTouchEnd={(event) => runFromTouch(event, () => askArticle(chatInput))}
            style={{
              ...askButtonStyle,
              opacity: isTyping || !chatInput.trim() ? 0.4 : 1,
              cursor: isTyping || !chatInput.trim() ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(event) => {
              if (!event.currentTarget.disabled) event.currentTarget.style.opacity = "0.85"
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.opacity =
                isTyping || !chatInput.trim() ? "0.4" : "1"
            }}
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
  color: "var(--text-dim)",
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
  color: "var(--text-dim)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 400,
  letterSpacing: "0.3px",
  marginTop: 3,
}

const summaryListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
}

const summaryItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: 12,
  color: "rgba(232,232,240,0.92)",
  fontFamily: "var(--font-ai)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.75,
  letterSpacing: "0.01em",
}

const summaryNumberStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  paddingTop: 4,
}

const emptySummaryStyle: CSSProperties = {
  color: "var(--text-dim)",
  fontFamily: "var(--font-ai)",
  fontSize: 14,
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
  color: "var(--text-dim)",
  fontFamily: "var(--font-ai)",
  fontSize: 13,
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
  fontFamily: "var(--font-ai)",
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.65,
  letterSpacing: "0.005em",
  whiteSpace: "pre-wrap",
}

const typingStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
}

const thinkingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
}

const thinkingBubbleStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "center",
  padding: "10px 14px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "0 8px 8px 8px",
}

const thinkingDotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "var(--accent)",
  display: "inline-block",
  animation: "thinking-dot 1.2s ease-in-out infinite",
}

const thinkingTextStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
  marginLeft: 6,
  letterSpacing: "0.5px",
}

const streamingBubbleStyle: CSSProperties = {
  ...messageStyle,
  alignSelf: "flex-start",
  maxWidth: "86%",
  padding: "14px 18px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "0 8px 8px 8px",
  color: "var(--text)",
}

const streamingCursorStyle: CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 14,
  background: "var(--accent)",
  marginLeft: 2,
  verticalAlign: "text-bottom",
  animation: "cursor-blink 0.8s step-end infinite",
}

const chatFormStyle: CSSProperties = {
  display: "flex",
  border: "1px solid var(--border2)",
  borderRadius: 6,
  overflow: "hidden",
  background: "var(--surface2)",
  transition: "border-color 0.15s, background 0.15s",
}

const chatInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  color: "var(--text)",
  padding: "12px 16px",
  borderRadius: "6px 0 0 6px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  outline: "none",
}

const askButtonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "1.5px",
  padding: "12px 18px",
  border: "none",
  borderRadius: "0 6px 6px 0",
  transition: "opacity 0.15s",
  whiteSpace: "nowrap",
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

const formattedListStyle: CSSProperties = {
  margin: "8px 0",
  paddingLeft: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const formattedListItemStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  fontFamily: "var(--font-ai)",
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--text)",
}

const formattedBulletStyle: CSSProperties = {
  color: "var(--accent)",
  flexShrink: 0,
  marginTop: 3,
  fontSize: 8,
}

const formattedParagraphStyle: CSSProperties = {
  fontFamily: "var(--font-ai)",
  fontSize: 14,
  lineHeight: 1.7,
  margin: "4px 0",
}

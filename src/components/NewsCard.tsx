/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { NewsItem } from "@/types/news"
import { getInternalArticleLink } from "@/lib/articleLinks"
import { trackContextEvent } from "@/lib/contextTelemetry"
import { showFeedbackToast } from "@/components/FeedbackToast"
import type { NewsGridFeedContext } from "@/components/NewsGrid"
import { useAuthGate, useSession } from "@/context/AuthGateContext"

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

function canUseHover() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  )
}

export interface NewsItemWithAI extends NewsItem {
  summary?: string
  sentiment?: string
  aiTags?: string
  aiGenerated?: boolean
  isRead?: boolean
  isBookmarked?: boolean
}

export default function NewsCard({
  item,
  feedContext,
  feedPosition,
  priority = false,
}: {
  item: NewsItemWithAI
  feedContext?: NewsGridFeedContext
  feedPosition?: number
  priority?: boolean
}) {
  const color = TOPIC_COLORS[item.topic] || "var(--muted)"
  const bg = TOPIC_BG[item.topic] || "var(--surface2)"
  const articleHref = getInternalArticleLink(item)

  const articleRef = useRef<HTMLElement | null>(null)
  const impressionSentRef = useRef(false)
  const visibleSinceRef = useRef<number | null>(null)
  const [summary, setSummary] = useState<string | null>(item.summary || null)
  const [sentiment, setSentiment] = useState<string | null>(item.sentiment || null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [loadingTags, setLoadingTags] = useState(false)
  const [bookmarked, setBookmarked] = useState<boolean>(item.isBookmarked ?? false)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const lastTouchActivationAt = useRef(0)
  const [aiTags, setAiTags] = useState<string[]>(() => {
    try {
      return item.aiTags ? JSON.parse(item.aiTags) : []
    } catch {
      return []
    }
  })

  const { triggerAuthGate } = useAuthGate()
  const { hasSession } = useSession()

  useEffect(() => {
    const node = articleRef.current
    if (!node || impressionSentRef.current || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          visibleSinceRef.current = visibleSinceRef.current ?? Date.now()
          window.setTimeout(() => {
            if (impressionSentRef.current || visibleSinceRef.current === null) return
            const visibleMs = Date.now() - visibleSinceRef.current
            if (visibleMs < 800) return
            impressionSentRef.current = true
            trackCardEvent("impression", { visibleMs })
            observer.disconnect()
          }, 900)
          return
        }

        visibleSinceRef.current = null
      },
      { threshold: [0, 0.5, 0.75] }
    )

    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  function trackCardEvent(
    type: Parameters<typeof trackContextEvent>[0]["type"],
    extra: Partial<Parameters<typeof trackContextEvent>[0]> = {}
  ) {
    trackContextEvent({
      articleId: item.id,
      type,
      feedScope: feedContext?.scope,
      feedPosition,
      surface: feedContext?.surface ?? "card",
      source: item.source,
      context: {
        topic: item.topic,
        sentiment: feedContext?.sentiment ?? null,
        search: feedContext?.q ?? null,
        tag: feedContext?.tag ?? null,
        topicFilter: feedContext?.topic ?? null,
      },
      ...extra,
    })
  }

  function shouldIgnoreFollowUpClick(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    if (e.type === "pointerup" || e.type === "touchend") {
      lastTouchActivationAt.current = Date.now()
      return false
    }

    return Date.now() - lastTouchActivationAt.current < 700
  }

  async function handleSummarize(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    if (summary) {
      setShowSummary((v) => !v)
      return
    }

    if (!hasSession) {
      triggerAuthGate('summarize')
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
      if (res.status === 401) {
        triggerAuthGate('summarize')
        return
      }
      if (!res.ok || data.error) {
        setAiError("AI service is unavailable right now.")
        return
      }
      if (data.summary) {
        setSummary(data.summary)
        setShowSummary(true)
        trackCardEvent("ai_action", { context: { action: "summarize", topic: item.topic } })
      }
    } catch {
      setAiError("AI service is unavailable right now.")
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleSentiment(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    if (sentiment) return

    if (!hasSession) {
      triggerAuthGate('sentiment')
      return
    }

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
      if (res.status === 401) {
        triggerAuthGate('sentiment')
        return
      }
      if (!res.ok || data.error) {
        setAiError("AI service is unavailable right now.")
        return
      }
      if (data.sentiment) {
        setSentiment(data.sentiment)
        trackCardEvent("ai_action", { context: { action: "sentiment", topic: item.topic } })
      }
    } catch {
      setAiError("AI service is unavailable right now.")
    } finally {
      setLoadingSentiment(false)
    }
  }

  async function handleGenerateTags(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    if (aiTags.length > 0 || loadingTags) return

    if (!hasSession) {
      triggerAuthGate('tag')
      return
    }

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
      if (res.status === 401) {
        triggerAuthGate('tag')
        return
      }
      if (!res.ok || data.error) {
        setAiError("AI service is unavailable right now.")
        return
      }
      if (Array.isArray(data.tags)) {
        setAiTags(data.tags)
        trackCardEvent("ai_action", { context: { action: "tag", topic: item.topic } })
      }
    } catch {
      setAiError("AI service is unavailable right now.")
    } finally {
      setLoadingTags(false)
    }
  }

  async function handleBookmark(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    if (!hasSession) {
      triggerAuthGate('general')
      return
    }

    const method = bookmarked ? "DELETE" : "POST"
    try {
      const response = await fetch("/api/user/bookmarks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: item.id }),
      })

      if (response.ok) {
        const nextBookmarked = !bookmarked
        setBookmarked(nextBookmarked)
        trackCardEvent(nextBookmarked ? "bookmark" : "unbookmark")
        setAiError(null)
        return
      }

      if (response.status === 401) {
        triggerAuthGate('general')
        return
      }

      setAiError("Could not update bookmark right now.")
    } catch {
      setAiError("Could not update bookmark right now.")
    }
  }

  function handleArticleOpen() {
    trackCardEvent("click")
    fetch("/api/user/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: item.id }),
    }).catch(() => {})
    trackCardEvent("read")
  }

  function handleLike(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    const nextLiked = !liked
    setLiked(nextLiked)
    if (nextLiked) setDisliked(false)
    trackCardEvent(nextLiked ? "like" : "dislike")
    if (nextLiked) showFeedbackToast("More stories like this")
  }

  function handleDislike(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    const nextDisliked = !disliked
    setDisliked(nextDisliked)
    if (nextDisliked) setLiked(false)
    trackCardEvent(nextDisliked ? "dislike" : "like")
    if (nextDisliked) showFeedbackToast("Fewer stories like this")
  }

  function handleHide(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    setHidden(true)
    trackCardEvent("hide")
    showFeedbackToast("Article hidden", {
      label: "Undo",
      onClick: () => setHidden(false),
    })
  }

  async function handleShare(
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (shouldIgnoreFollowUpClick(e)) return

    const shareUrl = `${window.location.origin}${articleHref}`
    trackCardEvent("share")

    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, url: shareUrl })
        return
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      showFeedbackToast("Link copied to clipboard")
    } catch {
      showFeedbackToast("Could not copy link")
    }
  }


  function handleTouchAction<T extends HTMLButtonElement>(
    event: React.PointerEvent<T> | React.TouchEvent<T>,
    action: (event: React.PointerEvent<T> | React.TouchEvent<T>) => void | Promise<void>
  ) {
    if ("pointerType" in event && event.pointerType === "mouse") return
    void action(event)
  }

  const sentimentCfg =
    SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]

  if (hidden) {
    return (
      <article
        className="news-card news-card--hidden"
        style={{
          minHeight: 0,
          overflow: "hidden",
          maxHeight: 0,
          opacity: 0,
          margin: 0,
          padding: 0,
          border: "none",
          transition: "max-height 0.35s ease, opacity 0.25s ease, margin 0.35s ease",
        }}
      />
    )
  }

  return (
    <article
      ref={articleRef}
      className="news-card"
      style={{
        background: "linear-gradient(180deg, #161620 0%, #121218 100%)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 420,
        transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
        cursor: "default",
        opacity: item.isRead ? 0.55 : 1,
        position: "relative",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      onMouseEnter={(event) => {
        if (!canUseHover()) return
        event.currentTarget.style.borderColor = "var(--border2)"
        event.currentTarget.style.transform = "translateY(-2px)"
        event.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)"
      }}
      onMouseLeave={(event) => {
        if (!canUseHover()) return
        event.currentTarget.style.borderColor = "var(--border)"
        event.currentTarget.style.transform = "translateY(0)"
        event.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)"
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

      <a
        className="news-card-image card-image"
        href={articleHref}
        onClick={handleArticleOpen}
        aria-label={`Open article: ${item.title}`}
        style={{
        position: "relative",
        height: 180,
        overflow: "hidden",
        background: "var(--surface2)",
        display: "block",
        cursor: "pointer",
      }}>
        {item.image ? (
          <div className="relative w-full aspect-[16/9] overflow-hidden rounded-t-xl" style={{ width: "100%", height: "100%", position: "relative" }}>
            <Image
              src={item.image ?? '/placeholder-news.jpg'}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              priority={priority}
              style={{
                objectFit: "cover",
                objectPosition: "center top",
                transition: "transform 0.4s ease",
              }}
              onMouseEnter={(event) => {
                if (!canUseHover()) return
                event.currentTarget.style.transform = "scale(1.03)"
              }}
              onMouseLeave={(event) => {
                if (!canUseHover()) return
                event.currentTarget.style.transform = "scale(1)"
              }}
              onError={(event) => {
                const wrapper = (event.currentTarget as HTMLElement).parentElement?.parentElement
                if (wrapper) {
                  wrapper.style.background = bg
                  wrapper.style.display = "flex"
                  wrapper.style.alignItems = "center"
                  wrapper.style.justifyContent = "center"
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
          </div>
        ) : (
          <div style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,0.01) 10px,
                rgba(255,255,255,0.01) 20px
              ),
              var(--surface2)
            `,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "3px",
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
            pointerEvents: "none",
            userSelect: "none",
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
            pointerEvents: "none",
            userSelect: "none",
          }}>
            AI
          </div>
        )}
      </a>

      <div className="news-card-body" style={{
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
            cursor: "pointer",
          }}
          onMouseEnter={(event) => {
            if (!canUseHover()) return
            event.currentTarget.style.color = "var(--accent)"
          }}
          onMouseLeave={(event) => {
            if (!canUseHover()) return
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
                  if (!canUseHover()) return
                  event.currentTarget.style.borderColor = "var(--border-accent)"
                  event.currentTarget.style.color = "var(--accent)"
                }}
                onMouseLeave={(event) => {
                  if (!canUseHover()) return
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
            fontFamily: "var(--font-ai)",
            fontSize: 13,
            fontWeight: 500,
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

      <div className="news-card-footer card-footer" style={{
        borderTop: "1px solid var(--border)",
        padding: "10px 18px",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}>
        <span className="card-date" style={{
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
          className="card-action-btn"
          type="button"
          onClick={handleBookmark}
          onPointerUp={(event) => handleTouchAction(event, handleBookmark)}
          onTouchEnd={(event) => handleTouchAction(event, handleBookmark)}
          title={bookmarked ? "Remove bookmark" : "Bookmark"}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            lineHeight: 1,
            minWidth: 44,
            minHeight: 44,
            padding: "6px 10px",
            background: "transparent",
            color: bookmarked ? "var(--accent)" : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {bookmarked ? "★" : "☆"}
        </button>

        {aiTags.length === 0 && (
          <button
            className="card-action-btn"
            type="button"
            onClick={handleGenerateTags}
            onPointerUp={(event) => handleTouchAction(event, handleGenerateTags)}
            onTouchEnd={(event) => handleTouchAction(event, handleGenerateTags)}
            disabled={loadingTags}
            title="Generate AI tags"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.5px",
              minWidth: 44,
              minHeight: 44,
              padding: "6px 10px",
              background: "transparent",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              cursor: loadingTags ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {loadingTags ? "..." : "tags"}
          </button>
        )}

        <button
          className="card-action-btn"
          type="button"
          onClick={handleSentiment}
          onPointerUp={(event) => handleTouchAction(event, handleSentiment)}
          onTouchEnd={(event) => handleTouchAction(event, handleSentiment)}
          disabled={loadingSentiment || !!sentiment}
          title="Analyze sentiment"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.5px",
            minWidth: 44,
            minHeight: 44,
            padding: "6px 10px",
            background: "transparent",
            color: sentiment
              ? SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG]?.color || "var(--muted)"
              : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            cursor: sentiment || loadingSentiment ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {loadingSentiment ? "..." : sentiment ? "✓" : "mood"}
        </button>

        <button
          className="card-action-btn"
          type="button"
          onClick={handleSummarize}
          onPointerUp={(event) => handleTouchAction(event, handleSummarize)}
          onTouchEnd={(event) => handleTouchAction(event, handleSummarize)}
          disabled={loadingSummary}
          title="AI summarize"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.5px",
            minWidth: 44,
            minHeight: 44,
            padding: "6px 10px",
            background: showSummary ? "var(--accent-dim)" : "transparent",
            color: showSummary ? "var(--accent)" : "var(--muted)",
            border: `1px solid ${showSummary ? "var(--border-accent)" : "var(--border)"}`,
            borderRadius: 2,
            cursor: loadingSummary ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {loadingSummary ? "..." : showSummary ? "hide" : "summary"}
        </button>

        <button
          className="card-action-btn mobile-only"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (shouldIgnoreFollowUpClick(e)) return
            setShowMoreActions((v) => !v)
          }}
          onPointerUp={(e) => handleTouchAction(e, (ev) => {
            ev.stopPropagation()
            ev.preventDefault()
            setShowMoreActions((v) => !v)
          })}
          onTouchEnd={(e) => handleTouchAction(e, (ev) => {
            ev.stopPropagation()
            ev.preventDefault()
            setShowMoreActions((v) => !v)
          })}
          title="More actions"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            minWidth: 44,
            minHeight: 44,
            padding: "6px 10px",
            background: showMoreActions ? "var(--accent-dim)" : "transparent",
            color: showMoreActions ? "var(--accent)" : "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ⋯
        </button>
      </div>

      <div className={`card-feedback-row ${showMoreActions ? "show-on-mobile" : ""}`} style={{
        borderTop: "1px solid var(--border)",
        padding: "8px 18px 12px",
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 6,
      }}>
        <FeedbackButton
          label="More"
          active={liked}
          title="Show more like this"
          onClick={handleLike}
          onPointerUp={(event) => handleTouchAction(event, handleLike)}
          onTouchEnd={(event) => handleTouchAction(event, handleLike)}
        />
        <FeedbackButton
          label="Less"
          active={disliked}
          title="Show less like this"
          onClick={handleDislike}
          onPointerUp={(event) => handleTouchAction(event, handleDislike)}
          onTouchEnd={(event) => handleTouchAction(event, handleDislike)}
        />
        <FeedbackButton
          label="Share"
          title="Share"
          onClick={handleShare}
          onPointerUp={(event) => handleTouchAction(event, handleShare)}
          onTouchEnd={(event) => handleTouchAction(event, handleShare)}
        />
        <FeedbackButton
          label="Hide"
          title="Hide article"
          danger
          onClick={handleHide}
          onPointerUp={(event) => handleTouchAction(event, handleHide)}
          onTouchEnd={(event) => handleTouchAction(event, handleHide)}
        />
      </div>
    </article>
  )
}

function FeedbackButton({
  label,
  active = false,
  danger = false,
  title,
  onClick,
  onPointerUp,
  onTouchEnd,
}: {
  label: string
  active?: boolean
  danger?: boolean
  title: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void | Promise<void>
  onTouchEnd: (event: React.TouchEvent<HTMLButtonElement>) => void | Promise<void>
}) {
  return (
    <button
      className="card-action-btn"
      type="button"
      title={title}
      onClick={onClick}
      onPointerUp={onPointerUp}
      onTouchEnd={onTouchEnd}
      style={{
        minHeight: 36,
        padding: "6px 8px",
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : danger ? "var(--negative)" : "var(--muted)",
        border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
        borderRadius: 2,
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  )
}

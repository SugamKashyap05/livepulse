"use client"

export type ContextTelemetryEvent = {
  articleId: string
  type:
    | "impression"
    | "click"
    | "read"
    | "dwell"
    | "bookmark"
    | "unbookmark"
    | "like"
    | "dislike"
    | "hide"
    | "share"
    | "comment"
    | "ai_action"
  value?: number
  durationMs?: number
  visibleMs?: number
  scrollDepth?: number
  feedScope?: string
  feedPosition?: number
  surface?: string
  source?: string
  sessionId?: string
  pageViewId?: string
  context?: Record<string, unknown>
  occurredAt?: string
}

const ANONYMOUS_ID_KEY = "livepulse.anonymousId"
const SESSION_ID_KEY = "livepulse.sessionId"

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}_${random}`
}

export function getLivePulseAnonymousId() {
  if (typeof window === "undefined") return null
  try {
    const existing = localStorage.getItem(ANONYMOUS_ID_KEY)
    if (existing) return existing
    const next = createId("anon")
    localStorage.setItem(ANONYMOUS_ID_KEY, next)
    return next
  } catch {
    return null
  }
}

export function getLivePulseSessionId() {
  if (typeof window === "undefined") return null
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY)
    if (existing) return existing
    const next = createId("session")
    sessionStorage.setItem(SESSION_ID_KEY, next)
    return next
  } catch {
    return null
  }
}

export function clearLivePulseTelemetryIdentity() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(ANONYMOUS_ID_KEY)
    sessionStorage.removeItem(SESSION_ID_KEY)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function createPageViewId() {
  return createId("view")
}

export function trackContextEvent(event: ContextTelemetryEvent) {
  trackContextEvents([event])
}

export function trackContextEvents(events: ContextTelemetryEvent[]) {
  if (typeof window === "undefined" || events.length === 0) return

  const payload = JSON.stringify({
    anonymousId: getLivePulseAnonymousId(),
    events: events.map((event) => ({
      ...event,
      sessionId: event.sessionId ?? getLivePulseSessionId(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    })),
  })

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" })
    if (navigator.sendBeacon("/api/context/events", blob)) return
  }

  fetch("/api/context/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}

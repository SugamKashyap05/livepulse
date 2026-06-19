"use client"

import { useEffect, useRef } from "react"
import {
  createPageViewId,
  trackContextEvent,
} from "@/lib/contextTelemetry"

type ArticleDwellTrackerProps = {
  articleId: string
  topic: string
  source: string
  surface: "article" | "ai-report"
}

export default function ArticleDwellTracker({
  articleId,
  topic,
  source,
  surface,
}: ArticleDwellTrackerProps) {
  const pageViewIdRef = useRef(createPageViewId())
  const startedAtRef = useRef(Date.now())
  const lastFlushAtRef = useRef(Date.now())
  const maxScrollDepthRef = useRef(0)
  const readSentRef = useRef(false)

  useEffect(() => {
    trackContextEvent({
      articleId,
      type: "click",
      surface,
      source,
      pageViewId: pageViewIdRef.current,
      context: { topic },
    })

    function updateScrollDepth() {
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      )
      const viewportBottom = window.scrollY + window.innerHeight
      const scrollable = Math.max(documentHeight - window.innerHeight, 1)
      const depth = Math.min(Math.max(viewportBottom / scrollable, 0), 1)
      maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, depth)
    }

    function flush(reason: string) {
      updateScrollDepth()
      const now = Date.now()
      const durationMs = now - lastFlushAtRef.current
      if (durationMs < 1500) return

      lastFlushAtRef.current = now
      if (
        !readSentRef.current &&
        (now - startedAtRef.current >= 8000 || maxScrollDepthRef.current >= 0.55)
      ) {
        readSentRef.current = true
        trackContextEvent({
          articleId,
          type: "read",
          durationMs: now - startedAtRef.current,
          scrollDepth: maxScrollDepthRef.current,
          surface,
          source,
          pageViewId: pageViewIdRef.current,
          context: { topic, reason: "engaged_read" },
        })
      }

      trackContextEvent({
        articleId,
        type: "dwell",
        durationMs,
        scrollDepth: maxScrollDepthRef.current,
        surface,
        source,
        pageViewId: pageViewIdRef.current,
        context: {
          topic,
          reason,
          totalDwellMs: now - startedAtRef.current,
        },
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush("hidden")
    }

    updateScrollDepth()
    const interval = window.setInterval(() => flush("interval"), 15000)
    window.addEventListener("scroll", updateScrollDepth, { passive: true })
    window.addEventListener("pagehide", () => flush("pagehide"))
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      flush("unmount")
      window.removeEventListener("scroll", updateScrollDepth)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [articleId, source, surface, topic])

  return null
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type ToastMessage = {
  id: string
  text: string
  action?: { label: string; onClick: () => void }
}

type FeedbackToastContextType = {
  show: (text: string, action?: ToastMessage["action"]) => void
}

let globalShow: FeedbackToastContextType["show"] | null = null

export function showFeedbackToast(
  text: string,
  action?: ToastMessage["action"]
) {
  globalShow?.(text, action)
}

const TOAST_DURATION_MS = 4000

export default function FeedbackToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (text: string, action?: ToastMessage["action"]) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      setToasts((prev) => [...prev.slice(-2), { id, text, action }])
      const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS)
      timersRef.current.set(id, timer)
    },
    [dismiss]
  )

  useEffect(() => {
    globalShow = show
    return () => {
      globalShow = null
    }
  }, [show])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 18px",
            background: "rgba(22, 22, 32, 0.96)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--border2)",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--text-dim)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
            animation: "feedbackToastSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            whiteSpace: "nowrap",
          }}
        >
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                dismiss(toast.id)
              }}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--accent)",
                background: "transparent",
                border: "1px solid var(--border-accent)",
                borderRadius: 3,
                padding: "4px 10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted2)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes feedbackToastSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

"use client"

import { useState } from "react"

export default function BatchActionButton({ action, articleIds, label }: { action: string, articleIds: string[], label: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleRun = async () => {
    if (articleIds.length === 0) return
    setLoading(true)
    try {
      const res = await fetch("/api/ai/batch", {
        method: "POST",
        body: JSON.stringify({ action, articleIds }),
      })
      if (res.ok) setDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRun}
      disabled={loading || articleIds.length === 0 || done}
      style={{
        padding: "10px 16px",
        background: done ? "rgba(74,240,196,0.1)" : "var(--accent)",
        color: done ? "#4af0c4" : "var(--bg)",
        border: "none",
        borderRadius: 4,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 1,
        cursor: (loading || articleIds.length === 0 || done) ? "default" : "pointer",
        opacity: (loading || articleIds.length === 0 || done) ? 0.6 : 1,
        transition: "all 0.2s",
      }}
    >
      {loading ? "PROCESSING..." : done ? "BATCH COMPLETE" : label}
    </button>
  )
}

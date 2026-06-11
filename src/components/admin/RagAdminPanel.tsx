"use client"

import { useState } from "react"

type RagStatus = {
  totalPublished: number
  embedded: number
  chunks: number
  coverage: number
  embeddingModel: string
  lastIndexed: string | null
  lastError: string | null
}

export default function RagAdminPanel({
  initialStatus,
}: {
  initialStatus: RagStatus
}) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const remaining = Math.max(status.totalPublished - status.embedded, 0)

  async function refreshStatus() {
    const res = await fetch("/api/admin/rag/status")
    if (!res.ok) return
    setStatus(await res.json())
  }

  async function runReindex(mode: "missing" | "recent" | "all") {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/admin/rag/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          limit: 20,
          all: mode === "missing",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error || "Reindex failed")
        return
      }
      setMessage(`Reindex ${mode} complete`)
      await refreshStatus()
    } catch (error) {
      setMessage(`Reindex failed: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
        marginBottom: 14,
      }}>
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 6,
          }}>
            RAG Index
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}>
            {status.embedded}/{status.totalPublished} articles embedded
            {" | "}
            {status.chunks} chunks
            {" | "}
            {status.coverage}% coverage
            {" | "}
            {status.embeddingModel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            {
              mode: "missing" as const,
              label: `Index Missing (${remaining})`,
            },
            { mode: "recent" as const, label: "Recent 20" },
            {
              mode: "all" as const,
              label: `Rebuild All (${status.totalPublished})`,
            },
          ].map((action) => (
            <button
              key={action.mode}
              onClick={() => runReindex(action.mode)}
              disabled={loading}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                padding: "7px 10px",
                background: loading ? "transparent" : "var(--surface2)",
                color: loading ? "var(--muted)" : "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Working..." : action.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        color: status.lastError ? "#ff4d4d" : "var(--muted)",
      }}>
        Last indexed: {status.lastIndexed
          ? new Date(status.lastIndexed).toLocaleString()
          : "never"}
        {status.lastError ? ` | Last error: ${status.lastError}` : ""}
        {remaining > 0 ? ` | ${remaining} articles left` : ""}
        {message ? ` | ${message}` : ""}
      </div>
    </div>
  )
}

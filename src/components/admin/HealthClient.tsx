"use client"

import { useState } from "react"

type Source = { name: string; url: string; topic: string }
type Status = "idle" | "pinging" | "ok" | "slow" | "error"

type Result = {
  status: Status
  ms?: number
}

const TOPIC_COLORS: Record<string, string> = {
  World: "#6c8fff",
  Technology: "#4af0c4",
  India: "#f97316",
  Business: "#f5c542",
  Science: "#a78bfa",
  Sports: "#f472b6",
}

export default function HealthClient({ sources }: { sources: Source[] }) {
  const [results, setResults] = useState<Record<string, Result>>({})
  const [running, setRunning] = useState(false)

  function setResult(name: string, result: Result) {
    setResults((p) => ({ ...p, [name]: result }))
  }

  async function pingOne(s: Source) {
    setResult(s.name, { status: "pinging" })
    const start = Date.now()
    try {
      const res = await fetch(
        `/api/admin/ping?url=${encodeURIComponent(s.url)}`,
        { signal: AbortSignal.timeout(10000) }
      )
      const ms = Date.now() - start
      const data = await res.json()
      const status = !data.ok ? "error" : ms > 3000 ? "slow" : "ok"
      setResult(s.name, { status, ms })
    } catch {
      setResult(s.name, { status: "error" })
    }
  }

  async function pingAll() {
    setRunning(true)
    setResults({})
    await Promise.all(sources.map(pingOne))
    setRunning(false)
  }

  const done = Object.keys(results).length
  const ok = Object.values(results).filter((r) => r.status === "ok").length
  const slow = Object.values(results).filter((r) => r.status === "slow").length
  const errors = Object.values(results).filter((r) => r.status === "error").length

  function statusColor(s: Status) {
    if (s === "ok") return "#4af0c4"
    if (s === "slow") return "#f5c542"
    if (s === "error") return "#ff4d4d"
    if (s === "pinging") return "var(--muted)"
    return "var(--border)"
  }

  function statusLabel(name: string) {
    const r = results[name]
    if (!r) return { text: "—", color: "var(--border2)" }
    if (r.status === "pinging") return { text: "pinging...", color: "var(--muted)" }
    if (r.status === "ok") return { text: `✓ ${r.ms}ms`, color: "#4af0c4" }
    if (r.status === "slow") return { text: `⚠ ${r.ms}ms`, color: "#f5c542" }
    if (r.status === "error") return { text: "✗ unreachable", color: "#ff4d4d" }
    return { text: "—", color: "var(--muted)" }
  }

  return (
    <div>
      {/* Summary bar */}
      {done > 0 && (
        <div style={{
          display: "flex",
          gap: 24,
          marginBottom: 20,
          padding: "14px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
        }}>
          <span style={{ color: "#4af0c4" }}>✓ Online: {ok}</span>
          <span style={{ color: "#f5c542" }}>⚠ Slow: {slow}</span>
          <span style={{ color: "#ff4d4d" }}>✗ Error: {errors}</span>
          <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
            {done}/{sources.length} checked
          </span>
        </div>
      )}

      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={pingAll}
          disabled={running}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "10px 24px",
            background: running ? "transparent" : "var(--accent)",
            color: running ? "var(--muted)" : "#000",
            border: `1px solid ${running ? "var(--border)" : "var(--accent)"}`,
            borderRadius: 3,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? `Checking ${done}/${sources.length}...` : "Run Health Check"}
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 12,
      }}>
        {sources.map((s) => {
          const { text, color } = statusLabel(s.name)
          const r = results[s.name]
          return (
            <div
              key={s.name}
              style={{
                background: "var(--surface)",
                border: `1px solid ${r ? statusColor(r.status) + "44" : "var(--border)"}`,
                borderRadius: 6,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "border-color 0.3s",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}>
                <div>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text)",
                  }}>
                    {s.name}
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    color: TOPIC_COLORS[s.topic] || "var(--muted)",
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}>
                    {s.topic}
                  </div>
                </div>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color,
                  textAlign: "right",
                }}>
                  {text}
                </span>
              </div>

              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {s.url}
              </div>

              {r && r.status !== "pinging" && (
                <div style={{
                  height: 3,
                  borderRadius: 2,
                  background: statusColor(r.status),
                  opacity: 0.6,
                  width: r.ms
                    ? `${Math.min(100, (r.ms / 5000) * 100)}%`
                    : "100%",
                  transition: "width 0.5s",
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

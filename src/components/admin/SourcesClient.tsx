"use client"

import { useState } from "react"

type Source = {
  name: string
  url: string
  topic: string
  slug: string
  articleCount: number
  lastFetched: string
}

type PingResult = "idle" | "pinging" | "ok" | "error"

const TOPIC_COLORS: Record<string, string> = {
  World: "#6c8fff",
  Technology: "#4af0c4",
  India: "#f97316",
  Business: "#f5c542",
  Science: "#a78bfa",
  Sports: "#f472b6",
}

export default function SourcesClient({ sources }: { sources: Source[] }) {
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({})
  const [pingTimes, setPingTimes] = useState<Record<string, number>>({})
  const [pingingAll, setPingingAll] = useState(false)

  async function pingSource(url: string, name: string) {
    setPingResults((p) => ({ ...p, [name]: "pinging" }))
    const start = Date.now()
    try {
      const res = await fetch(
        `/api/admin/ping?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(10000) }
      )
      const ms = Date.now() - start
      setPingTimes((p) => ({ ...p, [name]: ms }))
      setPingResults((p) => ({
        ...p,
        [name]: res.ok ? "ok" : "error",
      }))
    } catch {
      setPingResults((p) => ({ ...p, [name]: "error" }))
    }
  }

  async function pingAll() {
    setPingingAll(true)
    await Promise.all(sources.map((s) => pingSource(s.url, s.name)))
    setPingingAll(false)
  }

  function pingColor(r: PingResult) {
    if (r === "ok") return "#4af0c4"
    if (r === "error") return "#ff4d4d"
    if (r === "pinging") return "#f5c542"
    return "var(--muted)"
  }

  function pingLabel(name: string) {
    const r = pingResults[name] || "idle"
    if (r === "pinging") return "..."
    if (r === "ok") return `✓ ${pingTimes[name]}ms`
    if (r === "error") return "✗ fail"
    return "ping"
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={pingAll}
          disabled={pingingAll}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "8px 20px",
            background: "transparent",
            color: pingingAll ? "var(--muted)" : "var(--accent)",
            border: `1px solid ${pingingAll ? "var(--border)" : "var(--accent)"}`,
            borderRadius: 3,
            cursor: pingingAll ? "not-allowed" : "pointer",
          }}
        >
          {pingingAll ? "Pinging all..." : "Ping All Sources"}
        </button>
      </div>

      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}>
          <span>Source</span>
          <span>Topic</span>
          <span>Articles</span>
          <span>Last Fetched</span>
          <span>Status</span>
        </div>

        {sources.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
              padding: "14px 20px",
              borderBottom: i < sources.length - 1
                ? "1px solid var(--border)"
                : "none",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
              }}>
                {s.name}
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "var(--muted)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 280,
              }}>
                {s.url}
              </div>
            </div>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: TOPIC_COLORS[s.topic] || "var(--muted)",
            }}>
              {s.topic}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              color: "var(--accent)",
              fontWeight: 500,
            }}>
              {s.articleCount}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "var(--muted)",
            }}>
              {s.lastFetched}
            </span>

            <button
              onClick={() => pingSource(s.url, s.name)}
              disabled={pingResults[s.name] === "pinging"}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                letterSpacing: "1px",
                padding: "5px 10px",
                background: "transparent",
                color: pingColor(pingResults[s.name] || "idle"),
                border: `1px solid ${pingColor(pingResults[s.name] || "idle")}`,
                borderRadius: 3,
                cursor: pingResults[s.name] === "pinging"
                  ? "not-allowed"
                  : "pointer",
                minWidth: 80,
                textAlign: "center",
              }}
            >
              {pingLabel(s.name)}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

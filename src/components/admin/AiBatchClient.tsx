"use client"

import { useState } from "react"

type Task = "sentiment" | "tag" | "summarize" | "all"

type BatchResult = {
  processed: number
  failed: number
  total: number
  message?: string
}

export default function AiBatchClient() {
  const [task, setTask] = useState<Task>("sentiment")
  const [limit, setLimit] = useState(20)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runBatch() {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch("/api/ai/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, limit }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const tasks: { value: Task; label: string; desc: string; color: string }[] = [
    { value: "sentiment", label: "Sentiment", desc: "positive/neutral/negative", color: "#4af0c4" },
    { value: "tag",       label: "AI Tags",   desc: "specific topic tags",       color: "#6c8fff" },
    { value: "summarize", label: "Summarize", desc: "3-bullet summaries",        color: "#a78bfa" },
    { value: "all",       label: "Run All",   desc: "all tasks at once",         color: "#f5c542" },
  ]

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: 24,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: "var(--muted)",
        marginBottom: 20,
      }}>
        Batch AI Processor
      </div>

      {/* Task selector */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        marginBottom: 20,
      }}>
        {tasks.map((t) => (
          <button
            key={t.value}
            onClick={() => setTask(t.value)}
            style={{
              padding: "10px 8px",
              background: task === t.value
                ? `${t.color}15`
                : "transparent",
              border: `1px solid ${task === t.value ? t.color : "var(--border)"}`,
              borderRadius: 4,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              fontWeight: 500,
              color: task === t.value ? t.color : "var(--text)",
              marginBottom: 3,
            }}>
              {t.label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              color: "var(--muted)",
            }}>
              {t.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Limit */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
        }}>
          Process:
        </span>
        {[10, 20, 50, 100].map((n) => (
          <button
            key={n}
            onClick={() => setLimit(n)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              padding: "4px 12px",
              background: limit === n ? "var(--accent)" : "transparent",
              color: limit === n ? "#000" : "var(--muted)",
              border: `1px solid ${limit === n ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            {n}
          </button>
        ))}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: "var(--muted)",
        }}>
          articles
        </span>
      </div>

      {/* Run button */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={runBatch}
          disabled={running}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "10px 28px",
            background: running ? "transparent" : "var(--accent)",
            color: running ? "var(--muted)" : "#000",
            border: `1px solid ${running ? "var(--border)" : "var(--accent)"}`,
            borderRadius: 3,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? `Processing ${limit} articles...` : `Run ${task}`}
        </button>

        {result && !running && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--accent)",
          }}>
            {result.message || `✓ ${result.processed} done · ${result.failed} failed`}
          </span>
        )}

        {error && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "#ff4d4d",
          }}>
            ✗ {error}
          </span>
        )}
      </div>
    </div>
  )
}

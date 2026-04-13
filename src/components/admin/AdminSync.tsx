"use client"

import { useState } from "react"

type SyncResult = {
  success: boolean
  saved?: number
  skipped?: number
  total?: number
  error?: string
}

type LogEntry = {
  time: string
  result: SyncResult
}

export default function AdminSync() {
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  async function handleSync() {
    setSyncing(true)
    setLastResult(null)

    try {
      const res = await fetch("/api/sync")
      const data: SyncResult = await res.json()
      setLastResult(data)
      setLog((prev) => [
        { time: new Date().toLocaleTimeString(), result: data },
        ...prev.slice(0, 9),
      ])
    } catch {
      const err = { success: false, error: "Network error" }
      setLastResult(err)
      setLog((prev) => [
        { time: new Date().toLocaleTimeString(), result: err },
        ...prev.slice(0, 9),
      ])
    } finally {
      setSyncing(false)
    }
  }

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
        marginBottom: 16,
      }}>
        Manual Sync Control
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "10px 24px",
            background: syncing ? "transparent" : "var(--accent)",
            color: syncing ? "var(--muted)" : "#000",
            border: `1px solid ${syncing ? "var(--border)" : "var(--accent)"}`,
            borderRadius: 3,
            cursor: syncing ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>

        {syncing && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--accent)",
            animation: "pulse 1s ease-in-out infinite",
          }}>
            Fetching 13 feeds...
          </span>
        )}

        {lastResult && !syncing && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: lastResult.success ? "var(--accent)" : "#ff4d4d",
          }}>
            {lastResult.success
              ? `✓ saved: ${lastResult.saved}  skipped: ${lastResult.skipped}  total: ${lastResult.total}`
              : `✗ ${lastResult.error}`}
          </span>
        )}
      </div>

      {/* Sync log */}
      {log.length > 0 && (
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 8,
          }}>
            Sync History
          </div>
          {log.map((entry, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--muted)", minWidth: 80 }}>
                {entry.time}
              </span>
              <span style={{
                color: entry.result.success ? "var(--accent)" : "#ff4d4d",
              }}>
                {entry.result.success
                  ? `saved: ${entry.result.saved} / total: ${entry.result.total}`
                  : `failed: ${entry.result.error}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

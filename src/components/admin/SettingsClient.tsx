"use client"

import { useState } from "react"

export default function SettingsClient({
  total,
  oldestDate,
}: {
  total: number
  oldestDate: string
}) {
  const [retention, setRetention] = useState(3)
  const [maxPerFeed, setMaxPerFeed] = useState(15)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handlePurge() {
    if (!confirm(`Delete articles older than ${retention} days?`)) return
    setPurging(true)
    setPurgeResult(null)
    try {
      const res = await fetch(
        `/api/admin/purge?days=${retention}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      setPurgeResult(`Deleted ${data.deleted} old articles`)
    } catch {
      setPurgeResult("Purge failed")
    } finally {
      setPurging(false)
    }
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const labelStyle = {
    fontFamily: "'IBM Plex Mono', monospace" as const,
    fontSize: 10,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    color: "var(--muted)",
    display: "block",
    marginBottom: 8,
  }

  const inputStyle = {
    background: "var(--surface2)",
    border: "1px solid var(--border2)",
    borderRadius: 3,
    padding: "10px 14px",
    fontFamily: "'IBM Plex Mono', monospace" as const,
    fontSize: 14,
    color: "var(--text)",
    width: "100%",
    outline: "none",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 560 }}>

      {/* Sync settings */}
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
          Sync Configuration
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Max Articles Per Feed</label>
          <input
            type="number"
            min={5}
            max={50}
            value={maxPerFeed}
            onChange={(e) => setMaxPerFeed(Number(e.target.value))}
            style={inputStyle}
          />
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 6,
          }}>
            Currently fetching {maxPerFeed} × 13 sources = up to {maxPerFeed * 13} articles per sync
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Sync Interval</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="1" style={{ background: "var(--surface)" }}>Every 1 minute</option>
            <option value="5" selected style={{ background: "var(--surface)" }}>Every 5 minutes</option>
            <option value="10" style={{ background: "var(--surface)" }}>Every 10 minutes</option>
            <option value="30" style={{ background: "var(--surface)" }}>Every 30 minutes</option>
            <option value="60" style={{ background: "var(--surface)" }}>Every hour</option>
          </select>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 6,
          }}>
            Note: Interval is set in vercel.json for production deployment
          </div>
        </div>

        <button
          onClick={handleSave}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "10px 24px",
            background: saved ? "transparent" : "var(--accent)",
            color: saved ? "var(--accent)" : "#000",
            border: "1px solid var(--accent)",
            borderRadius: 3,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {saved ? "✓ Saved" : "Save Settings"}
        </button>
      </div>

      {/* Data retention */}
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
          Data Retention
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
          padding: "14px 0",
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 4,
            }}>
              Total Articles
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--accent)",
            }}>
              {total}
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 4,
            }}>
              Oldest Article
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 14,
              color: "var(--text)",
              marginTop: 4,
            }}>
              {oldestDate}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Delete Articles Older Than (days)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={handlePurge}
            disabled={purging}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "10px 24px",
              background: "rgba(255,77,77,0.1)",
              color: purging ? "var(--muted)" : "#ff4d4d",
              border: `1px solid ${purging ? "var(--border)" : "rgba(255,77,77,0.4)"}`,
              borderRadius: 3,
              cursor: purging ? "not-allowed" : "pointer",
            }}
          >
            {purging ? "Purging..." : `Purge Old Articles`}
          </button>

          {purgeResult && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--accent)",
            }}>
              {purgeResult}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

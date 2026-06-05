"use client"

import type { CSSProperties } from "react"
import { useState } from "react"
import { ALL_TOPICS } from "@/lib/sources"

type Source = {
  id: string
  name: string
  url: string
  topic: string
  slug: string
  region: string
  enabled: boolean
  priority: number
  lastFetched: Date | string | null
  lastFetchedLabel: string
  lastStatus: string | null
  failCount: number
  articleCount: number
}

type PingResult = "idle" | "pinging" | "ok" | "error"

const REGIONS = [
  "global",
  "india",
  "uk",
  "us",
  "middleeast",
  "africa",
  "seasia",
  "latam",
  "eastasia",
]

const TOPIC_COLORS: Record<string, string> = {
  world: "#6c8fff",
  technology: "#4af0c4",
  india: "#f97316",
  business: "#f5c542",
  science: "#a78bfa",
  sports: "#f472b6",
  health: "#34d399",
  climate: "#22c55e",
  politics: "#fb7185",
}

const emptyForm = {
  name: "",
  url: "",
  topic: "world",
  region: "global",
  priority: 5,
}

export default function SourcesClient({ sources }: { sources: Source[] }) {
  const [items, setItems] = useState(sources)
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({})
  const [pingTimes, setPingTimes] = useState<Record<string, number>>({})
  const [pingingAll, setPingingAll] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function pingSource(url: string, name: string) {
    setPingResults((prev) => ({ ...prev, [name]: "pinging" }))
    const start = Date.now()
    try {
      const res = await fetch(
        `/api/admin/ping?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(10000) }
      )
      const ms = Date.now() - start
      setPingTimes((prev) => ({ ...prev, [name]: ms }))
      setPingResults((prev) => ({
        ...prev,
        [name]: res.ok ? "ok" : "error",
      }))
    } catch {
      setPingResults((prev) => ({ ...prev, [name]: "error" }))
    }
  }

  async function pingAll() {
    setPingingAll(true)
    await Promise.all(items.map((source) => pingSource(source.url, source.name)))
    setPingingAll(false)
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.topic,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "Could not add source")
        return
      }
      setItems((prev) => [
        ...prev,
        {
          ...data.source,
          articleCount: 0,
          lastFetchedLabel: "Never",
        },
      ])
      setForm(emptyForm)
      setShowForm(false)
      setMessage("Source added.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleSource(source: Source) {
    const res = await fetch("/api/admin/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id, enabled: !source.enabled }),
    })
    if (!res.ok) return
    setItems((prev) => prev.map((item) =>
      item.id === source.id ? { ...item, enabled: !item.enabled } : item
    ))
  }

  async function deleteSource(source: Source) {
    if (source.articleCount > 0) return
    if (!confirm(`Delete ${source.name}?`)) return

    const res = await fetch("/api/admin/sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id }),
    })
    if (!res.ok) return
    setItems((prev) => prev.filter((item) => item.id !== source.id))
  }

  function pingColor(result: PingResult) {
    if (result === "ok") return "#4af0c4"
    if (result === "error") return "#ff4d4d"
    if (result === "pinging") return "#f5c542"
    return "var(--muted)"
  }

  function pingLabel(name: string) {
    const result = pingResults[name] || "idle"
    if (result === "pinging") return "..."
    if (result === "ok") return `ok ${pingTimes[name]}ms`
    if (result === "error") return "fail"
    return "ping"
  }

  return (
    <div>
      <div style={{
        marginBottom: 16,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
      }}>
        <button
          onClick={() => setShowForm((value) => !value)}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            textTransform: "uppercase",
            padding: "8px 20px",
            background: showForm ? "var(--surface2)" : "var(--accent)",
            color: showForm ? "var(--text)" : "#000",
            border: "1px solid var(--accent)",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          {showForm ? "Close Form" : "+ Add Source"}
        </button>

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

      {message && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--accent)",
          marginBottom: 12,
        }}>
          {message}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={addSource}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 2fr 1fr 1fr 100px auto",
            gap: 8,
            alignItems: "end",
            padding: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <SourceInput label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <SourceInput label="URL" value={form.url} onChange={(value) => setForm({ ...form, url: value })} />
          <SourceSelect
            label="Topic"
            value={form.topic}
            options={ALL_TOPICS.filter((topic) => topic.slug !== "all").map((topic) => topic.slug)}
            onChange={(value) => setForm({ ...form, topic: value })}
          />
          <SourceSelect
            label="Region"
            value={form.region}
            options={REGIONS}
            onChange={(value) => setForm({ ...form, region: value })}
          />
          <SourceInput
            label="Priority"
            type="number"
            value={String(form.priority)}
            onChange={(value) => setForm({ ...form, priority: Number(value) })}
          />
          <button
            type="submit"
            disabled={saving}
            style={{
              height: 36,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              background: "var(--accent)",
              color: "#000",
              border: "none",
              borderRadius: 3,
              padding: "0 14px",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "..." : "Save"}
          </button>
        </form>
      )}

      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.8fr 150px",
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
          <span>Region</span>
          <span>Articles</span>
          <span>Last Fetched</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {items.map((source, index) => (
          <div
            key={source.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.8fr 0.8fr 0.7fr 0.8fr 0.8fr 150px",
              padding: "14px 20px",
              borderBottom: index < items.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
              opacity: source.enabled ? 1 : 0.55,
            }}
          >
            <div>
              <div style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
              }}>
                {source.name}
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
                {source.url}
              </div>
            </div>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: TOPIC_COLORS[source.topic] || "var(--muted)",
              textTransform: "uppercase",
            }}>
              {source.topic}
            </span>

            <span style={{
              width: "fit-content",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              color: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "3px 6px",
              textTransform: "uppercase",
            }}>
              {source.region}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              color: "var(--accent)",
              fontWeight: 500,
            }}>
              {source.articleCount}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "var(--muted)",
            }}>
              {source.lastFetchedLabel}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: source.lastStatus === "ok"
                ? "#4af0c4"
                : source.lastStatus === "error"
                  ? "#ff4d4d"
                  : "var(--muted)",
            }}>
              {source.lastStatus || "unknown"}
              {source.failCount > 0 ? ` (${source.failCount})` : ""}
            </span>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => pingSource(source.url, source.name)}
                disabled={pingResults[source.name] === "pinging"}
                style={actionButtonStyle(pingColor(pingResults[source.name] || "idle"))}
              >
                {pingLabel(source.name)}
              </button>
              <button
                onClick={() => toggleSource(source)}
                style={actionButtonStyle(source.enabled ? "#f5c542" : "#4af0c4")}
              >
                {source.enabled ? "off" : "on"}
              </button>
              {source.articleCount === 0 && (
                <button
                  onClick={() => deleteSource(source)}
                  style={actionButtonStyle("#ff4d4d")}
                >
                  del
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={fieldControlStyle}
      />
    </label>
  )
}

function SourceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={fieldControlStyle}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function actionButtonStyle(color: string): CSSProperties {
  return {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.5px",
    padding: "5px 7px",
    background: "transparent",
    color,
    border: `1px solid ${color}`,
    borderRadius: 3,
    cursor: "pointer",
    textTransform: "uppercase",
  }
}

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 9,
  color: "var(--muted)",
  letterSpacing: "1px",
  textTransform: "uppercase",
}

const fieldControlStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 36,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--text)",
  padding: "0 9px",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
}

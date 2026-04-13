"use client"

import { useState, useMemo } from "react"

type Article = {
  id: string
  title: string
  source: string
  topic: string
  pubDate: string
  link: string
  fetchedAt: string
}

const TOPIC_COLORS: Record<string, string> = {
  World: "#6c8fff",
  Technology: "#4af0c4",
  India: "#f97316",
  Business: "#f5c542",
  Science: "#a78bfa",
  Sports: "#f472b6",
}

export default function ArticlesClient({
  articles,
}: {
  articles: Article[]
}) {
  const [search, setSearch] = useState("")
  const [topicFilter, setTopicFilter] = useState("all")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const topics = ["all", ...Array.from(new Set(articles.map((a) => a.topic)))]

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (deleted.has(a.id)) return false
      if (topicFilter !== "all" && a.topic !== topicFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          a.title.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [articles, search, topicFilter, deleted])

  async function deleteArticle(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/admin/articles?id=${id}`, { method: "DELETE" })
      setDeleted((p) => new Set([...p, id]))
    } finally {
      setDeleting(null)
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete all ${filtered.length} filtered articles?`)) return
    setBulkDeleting(true)
    try {
      await fetch(
        `/api/admin/articles?topic=${topicFilter}&search=${search}`,
        { method: "DELETE" }
      )
      setDeleted((p) => new Set([...p, ...filtered.map((a) => a.id)]))
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <input
          type="text"
          placeholder="Search title or source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            borderRadius: 3,
            padding: "8px 14px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: "var(--text)",
            outline: "none",
          }}
        />

        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            borderRadius: 3,
            padding: "8px 14px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: "var(--text)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {topics.map((t) => (
            <option key={t} value={t} style={{ background: "var(--surface)" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
        }}>
          {filtered.length} results
        </span>

        {filtered.length > 0 && (
          <button
            onClick={bulkDelete}
            disabled={bulkDeleting}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              padding: "8px 16px",
              background: "rgba(255,77,77,0.1)",
              color: "#ff4d4d",
              border: "1px solid rgba(255,77,77,0.3)",
              borderRadius: 3,
              cursor: bulkDeleting ? "not-allowed" : "pointer",
            }}
          >
            {bulkDeleting ? "Deleting..." : `Delete ${filtered.length}`}
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 100px 120px 60px",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}>
          <span>Title</span>
          <span>Source</span>
          <span>Topic</span>
          <span>Date</span>
          <span></span>
        </div>

        {filtered.slice(0, 100).map((a, i) => (
          <div
            key={a.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 100px 120px 60px",
              padding: "12px 16px",
              borderBottom: i < filtered.length - 1
                ? "1px solid var(--border)"
                : "none",
              alignItems: "center",
              gap: 8,
            }}
          >
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                color: "var(--text)",
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {a.title}
            </a>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {a.source}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: TOPIC_COLORS[a.topic] || "var(--muted)",
            }}>
              {a.topic}
            </span>

            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "var(--muted)",
            }}>
              {new Date(a.pubDate).toLocaleDateString()}
            </span>

            <button
              onClick={() => deleteArticle(a.id)}
              disabled={deleting === a.id}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                padding: "4px 8px",
                background: "transparent",
                color: deleting === a.id ? "var(--muted)" : "#ff4d4d",
                border: "1px solid rgba(255,77,77,0.3)",
                borderRadius: 3,
                cursor: deleting === a.id ? "not-allowed" : "pointer",
              }}
            >
              {deleting === a.id ? "..." : "Del"}
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{
            padding: "40px",
            textAlign: "center",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: "var(--muted)",
          }}>
            No articles match your filter.
          </div>
        )}
      </div>
    </div>
  )
}

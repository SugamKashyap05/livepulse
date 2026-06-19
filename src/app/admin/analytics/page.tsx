"use client"

import { useCallback, useEffect, useState } from "react"

type AnalyticsData = {
  range: string
  since: string
  totalEvents: number
  eventsByType: { type: string; count: number }[]
  funnel: {
    impressions: number
    clicks: number
    reads: number
    bookmarks: number
    likes: number
    dislikes: number
    hides: number
    shares: number
  }
  conversionRates: { ctr: string; readRate: string; bookmarkRate: string }
  authSplit: { label: string; count: number }[]
  timeline: { hour: string; count: number }[]
}

const RANGE_OPTIONS = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
]

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [range, setRange] = useState("24h")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (r: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analytics/context?range=${r}`)
      if (!res.ok) {
        setError(`Failed to load analytics (${res.status})`)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError("Unable to reach analytics endpoint.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <p style={eyebrow}>Context Engine</p>
          <h1 style={title}>Analytics</h1>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              style={{
                ...rangeButton,
                background: range === opt.value ? "var(--accent-dim)" : "transparent",
                color: range === opt.value ? "var(--accent)" : "var(--muted)",
                borderColor: range === opt.value ? "var(--border-accent)" : "var(--border)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {loading && !data && (
        <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Loading analytics…
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Top-line metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <MetricCard label="Total Events" value={data.totalEvents.toLocaleString()} />
            <MetricCard label="CTR" value={`${data.conversionRates.ctr}%`} sublabel="Impressions → Clicks" />
            <MetricCard label="Read Rate" value={`${data.conversionRates.readRate}%`} sublabel="Clicks → Reads" />
            <MetricCard label="Bookmark Rate" value={`${data.conversionRates.bookmarkRate}%`} sublabel="Reads → Bookmarks" />
          </div>

          {/* Event Volume by Type */}
          <Panel title="Event Volume by Type">
            <div style={{ display: "grid", gap: 6 }}>
              {data.eventsByType.map((row) => {
                const max = data.eventsByType[0]?.count || 1
                const pct = Math.max((row.count / max) * 100, 2)
                return (
                  <div key={row.type} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...mono, minWidth: 80, textAlign: "right" }}>{row.type}</span>
                    <div style={{ flex: 1, height: 18, background: "var(--surface2)", borderRadius: 2, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: getEventColor(row.type),
                          borderRadius: 2,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    <span style={{ ...mono, minWidth: 60, textAlign: "right", color: "var(--text-dim)" }}>
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Engagement Funnel */}
          <Panel title="Engagement Funnel">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { label: "Impressions", value: data.funnel.impressions, color: "#718096" },
                { label: "Clicks", value: data.funnel.clicks, color: "#6c8fff" },
                { label: "Reads", value: data.funnel.reads, color: "#a78bfa" },
                { label: "Bookmarks", value: data.funnel.bookmarks, color: "#f5c542" },
                { label: "Likes", value: data.funnel.likes, color: "#3ecf8e" },
                { label: "Shares", value: data.funnel.shares, color: "#6c8fff" },
              ].map((step) => (
                <div key={step.label} style={{ textAlign: "center", flex: "1 1 80px" }}>
                  <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: step.color }}>
                    {step.value.toLocaleString()}
                  </div>
                  <div style={{ ...mono, fontSize: 9, color: "var(--muted)", marginTop: 4 }}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Auth Split + Timeline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <Panel title="Auth Split">
              {data.authSplit.map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span style={{ ...mono, textTransform: "capitalize" }}>{row.label}</span>
                  <span style={{ ...mono, color: "var(--text-dim)" }}>{row.count.toLocaleString()}</span>
                </div>
              ))}
            </Panel>

            <Panel title="Event Timeline">
              {data.timeline.length > 0 ? (
                <Sparkline data={data.timeline} />
              ) : (
                <div style={{ ...mono, color: "var(--muted2)", padding: "20px 0" }}>No timeline data</div>
              )}
            </Panel>
          </div>

          {/* Negative Signals */}
          <Panel title="Negative Signals">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center", flex: "1 1 80px" }}>
                <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: "#f56565" }}>
                  {data.funnel.dislikes.toLocaleString()}
                </div>
                <div style={{ ...mono, fontSize: 9, color: "var(--muted)", marginTop: 4 }}>Dislikes</div>
              </div>
              <div style={{ textAlign: "center", flex: "1 1 80px" }}>
                <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: "#f97316" }}>
                  {data.funnel.hides.toLocaleString()}
                </div>
                <div style={{ ...mono, fontSize: 9, color: "var(--muted)", marginTop: 4 }}>Hides</div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div style={metricCard}>
      <div style={{ ...mono, fontSize: 9, color: "var(--muted)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--text)", marginTop: 6 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ ...mono, fontSize: 9, color: "var(--muted2)", marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={panel}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--accent)", marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Sparkline({ data }: { data: { hour: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const barWidth = Math.max(Math.floor(600 / data.length) - 2, 2)

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 80, overflow: "hidden" }}>
      {data.map((point, i) => (
        <div
          key={i}
          title={`${new Date(point.hour).toLocaleString()}: ${point.count}`}
          style={{
            width: barWidth,
            height: `${Math.max((point.count / max) * 100, 3)}%`,
            background: "var(--accent)",
            opacity: 0.7,
            borderRadius: "1px 1px 0 0",
            transition: "height 0.3s ease",
          }}
        />
      ))}
    </div>
  )
}

function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    impression: "#718096",
    click: "#6c8fff",
    read: "#a78bfa",
    dwell: "#4a5568",
    bookmark: "#f5c542",
    unbookmark: "#b7a740",
    like: "#3ecf8e",
    dislike: "#f56565",
    hide: "#f97316",
    share: "#6c8fff",
    comment: "#f472b6",
    ai_action: "#a78bfa",
  }
  return colors[type] || "#718096"
}

const mono = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.5px",
} as const

const eyebrow = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--accent)",
  margin: "0 0 6px",
} as const

const title = {
  fontFamily: "var(--font-display)",
  fontSize: 32,
  fontWeight: 800,
  color: "var(--text)",
  margin: 0,
} as const

const rangeButton = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
  padding: "6px 14px",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  transition: "all 0.15s ease",
} as const

const errorBox = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "#f56565",
  background: "rgba(245,101,101,0.08)",
  border: "1px solid rgba(245,101,101,0.2)",
  borderRadius: 4,
  padding: "10px 14px",
  marginBottom: 20,
} as const

const metricCard = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "18px 20px",
} as const

const panel = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "20px 22px",
} as const

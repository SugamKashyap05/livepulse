"use client"

import type { CSSProperties, FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"

export type ResearchLibraryCoverageMetrics = {
  totalArticles: number
  indexedArticles: number
  missingEmbeddings: number
  lastIndexedAt?: string | Date | null
  modelStatus: string
}

export type ResearchLibraryTopicCoverageRow = {
  id?: string
  topic: string
  totalArticles: number
  indexedArticles: number
  missingEmbeddings?: number
  coveragePercent?: number
  oldestMissingAt?: string | Date | null
  status?: "healthy" | "partial" | "stale" | "failed" | string
}

export type ResearchLibraryIndexEvent = {
  id: string
  title: string
  detail?: string | null
  topic?: string | null
  status: "success" | "warning" | "failure" | "running" | string
  createdAt?: string | Date | null
  affectedArticles?: number | null
}

export type ResearchLibraryTestResult = {
  answer?: string | null
  citations?: Array<{
    id: string
    title: string
    source?: string | null
    score?: number | null
  }>
  latencyMs?: number | null
  model?: string | null
}

export type ResearchLibraryModuleProps = {
  metrics: ResearchLibraryCoverageMetrics
  topicCoverageRows: ResearchLibraryTopicCoverageRow[]
  indexEvents: ResearchLibraryIndexEvent[]
  onReindexMissing?: () => void | Promise<void>
  onReindexRecent?: () => void | Promise<void>
  onReindexAll?: () => void | Promise<void>
  onTestQuery?: (query: string) => ResearchLibraryTestResult | void | Promise<ResearchLibraryTestResult | void>
  onRefresh?: () => void | Promise<void>
  reindexEndpoint?: string
  testQueryEndpoint?: string
}

type Notice = {
  tone: "good" | "warn" | "bad"
  text: string
} | null

type ReindexMode = "missing" | "recent" | "all"

export default function ResearchLibraryModule({
  metrics,
  topicCoverageRows,
  indexEvents,
  onReindexMissing,
  onReindexRecent,
  onReindexAll,
  onTestQuery,
  onRefresh,
  reindexEndpoint = "/api/admin/rag/reindex",
  testQueryEndpoint = "/api/admin/rag/query",
}: ResearchLibraryModuleProps) {
  const [working, setWorking] = useState<ReindexMode | "query" | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [query, setQuery] = useState("")
  const [testResult, setTestResult] = useState<ResearchLibraryTestResult | null>(null)
  const [events, setEvents] = useState(indexEvents)

  useEffect(() => {
    setEvents(indexEvents)
  }, [indexEvents])

  const coveragePercent = useMemo(() => {
    if (metrics.totalArticles <= 0) return 0
    return Math.round((metrics.indexedArticles / metrics.totalArticles) * 100)
  }, [metrics.indexedArticles, metrics.totalArticles])

  const sortedTopics = useMemo(
    () =>
      [...topicCoverageRows].sort((a, b) => {
        const missingA = rowMissing(a)
        const missingB = rowMissing(b)
        if (missingA !== missingB) return missingB - missingA
        return a.topic.localeCompare(b.topic)
      }),
    [topicCoverageRows]
  )

  async function runReindex(mode: ReindexMode) {
    const callback =
      mode === "missing" ? onReindexMissing : mode === "recent" ? onReindexRecent : onReindexAll
    const confirmAll =
      mode !== "all" || confirm("Rebuild the full research index? This may take a while.")
    if (!confirmAll) return

    setWorking(mode)
    setNotice(null)
    try {
      if (callback) {
        await callback()
      } else {
        const res = await fetch(reindexEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Reindex failed")
      }

      setNotice({ tone: "good", text: `${labelForMode(mode)} queued successfully.` })
      await onRefresh?.()
    } catch (error) {
      console.error(`[research library ${mode}]`, error)
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : `${labelForMode(mode)} failed.` })
    } finally {
      setWorking(null)
    }
  }

  async function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim()) return

    setWorking("query")
    setNotice(null)
    setTestResult(null)
    try {
      const result = onTestQuery
        ? await onTestQuery(query.trim())
        : await fetchDefaultQuery(testQueryEndpoint, query.trim())
      setTestResult(result ?? { answer: "Query completed. No result payload was returned." })
      setNotice({ tone: "good", text: "Test query completed." })
    } catch (error) {
      console.error("[research library query]", error)
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Test query failed." })
    } finally {
      setWorking(null)
    }
  }

  return (
    <section style={shellStyle}>
      {notice && (
        <div style={{ ...noticeStyle, borderColor: toneColor(notice.tone) }}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} style={noticeCloseStyle}>
            CLOSE
          </button>
        </div>
      )}

      <div style={summaryGridStyle}>
        <MetricCard label="Corpus" value={formatNumber(metrics.totalArticles)} detail="articles available" />
        <MetricCard label="Indexed" value={`${coveragePercent}%`} detail={`${formatNumber(metrics.indexedArticles)} embedded`} tone={coveragePercent >= 90 ? "good" : coveragePercent >= 70 ? "warn" : "bad"} />
        <MetricCard label="Missing" value={formatNumber(metrics.missingEmbeddings)} detail="articles without embeddings" tone={metrics.missingEmbeddings === 0 ? "good" : "warn"} />
        <MetricCard label="Model" value={metrics.modelStatus} detail={`last indexed ${formatDate(metrics.lastIndexedAt)}`} />
      </div>

      <div style={actionRailStyle}>
        <div>
          <div style={panelTitleStyle}>RESEARCH LIBRARY</div>
          <p style={railCopyStyle}>
            RAG coverage, embedding gaps, index events, and quick retrieval checks for newsroom research.
          </p>
        </div>
        <div style={buttonRailStyle}>
          <ActionButton label={`INDEX MISSING (${metrics.missingEmbeddings})`} loading={working === "missing"} disabled={working !== null} onClick={() => runReindex("missing")} />
          <ActionButton label="RECENT ARTICLES" loading={working === "recent"} disabled={working !== null} onClick={() => runReindex("recent")} variant="secondary" />
          <ActionButton label="REBUILD ALL" loading={working === "all"} disabled={working !== null} onClick={() => runReindex("all")} variant="danger" />
          {onRefresh && (
            <button
              type="button"
              disabled={working !== null}
              onClick={() => onRefresh()}
              style={buttonStateStyle(secondaryButtonStyle, working !== null)}
            >
              REFRESH
            </button>
          )}
        </div>
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>TOPIC COVERAGE</span>
            <span>{sortedTopics.length}</span>
          </div>
          <div style={tableWrapStyle}>
            <div style={topicHeaderStyle}>
              <span>Topic</span>
              <span>Total</span>
              <span>Indexed</span>
              <span>Missing</span>
              <span>Coverage</span>
              <span>Status</span>
            </div>
            {sortedTopics.map((row) => {
              const percent = rowCoverage(row)
              return (
                <div key={row.id ?? row.topic} style={topicRowStyle}>
                  <span style={topicNameStyle}>{row.topic}</span>
                  <span>{formatNumber(row.totalArticles)}</span>
                  <span>{formatNumber(row.indexedArticles)}</span>
                  <span style={{ color: rowMissing(row) > 0 ? "#f5c542" : "#4af0c4" }}>{formatNumber(rowMissing(row))}</span>
                  <span>
                    <span style={barTrackStyle}>
                      <span style={{ ...barFillStyle, width: `${Math.min(Math.max(percent, 0), 100)}%`, background: toneColor(percent >= 90 ? "good" : percent >= 70 ? "warn" : "bad") }} />
                    </span>
                    {percent}%
                  </span>
                  <span style={{ color: statusColor(row.status, percent) }}>{(row.status ?? coverageStatus(percent)).toUpperCase()}</span>
                </div>
              )
            })}
            {sortedTopics.length === 0 && <div style={emptyStyle}>No topic coverage rows supplied.</div>}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>INDEX EVENTS</span>
            <span>{events.length}</span>
          </div>
          <div style={listStyle}>
            {events.map((event) => (
              <article key={event.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: statusTone(event.status) }}>{event.status.toUpperCase()}</span>
                  <span>{event.topic ?? "all topics"}</span>
                  <span>{formatDate(event.createdAt)}</span>
                </div>
                <h3 style={itemTitleStyle}>{event.title}</h3>
                <p style={descriptionStyle}>{event.detail ?? "No event detail supplied."}</p>
                {typeof event.affectedArticles === "number" && (
                  <div style={footnoteStyle}>{formatNumber(event.affectedArticles)} articles affected</div>
                )}
              </article>
            ))}
            {events.length === 0 && <div style={emptyStyle}>No recent index events.</div>}
          </div>
        </section>
      </div>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span>RETRIEVAL TEST</span>
          <span>{working === "query" ? "RUNNING" : "READY"}</span>
        </div>
        <form onSubmit={submitQuery} style={queryFormStyle}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={working !== null}
            placeholder="Ask a research question against the indexed corpus..."
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={working !== null || !query.trim()}
            style={buttonStateStyle(primaryButtonStyle, working !== null || !query.trim(), working === "query")}
          >
            {working === "query" ? "TESTING..." : "TEST QUERY"}
          </button>
        </form>
        {testResult && (
          <div style={resultStyle}>
            <div style={resultMetaStyle}>
              <span>{testResult.model ?? metrics.modelStatus}</span>
              <span>{typeof testResult.latencyMs === "number" ? `${testResult.latencyMs}ms` : "latency n/a"}</span>
            </div>
            <p style={descriptionStyle}>{testResult.answer ?? "No answer text returned."}</p>
            {testResult.citations && testResult.citations.length > 0 && (
              <div style={citationGridStyle}>
                {testResult.citations.map((citation) => (
                  <div key={citation.id} style={citationStyle}>
                    <strong>{citation.title}</strong>
                    <span>
                      {citation.source ?? "unknown source"}
                      {typeof citation.score === "number" ? ` | score ${citation.score.toFixed(2)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  )
}

async function fetchDefaultQuery(endpoint: string, query: string) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Test query failed")
  return data as ResearchLibraryTestResult
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone?: "good" | "warn" | "bad"
}) {
  return (
    <div style={summaryCellStyle}>
      <span>{label}</span>
      <strong style={{ color: tone ? toneColor(tone) : "var(--text)" }}>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function ActionButton({
  label,
  loading,
  disabled,
  onClick,
  variant = "primary",
}: {
  label: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  variant?: "primary" | "secondary" | "danger"
}) {
  const style =
    variant === "danger" ? dangerButtonStyle : variant === "secondary" ? secondaryButtonStyle : primaryButtonStyle
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={buttonStateStyle(style, disabled, loading)}>
      {loading ? "WORKING..." : label}
    </button>
  )
}

function buttonStateStyle(base: CSSProperties, disabled: boolean, active = false): CSSProperties {
  return {
    ...base,
    opacity: disabled && !active ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  }
}

function rowMissing(row: ResearchLibraryTopicCoverageRow) {
  return row.missingEmbeddings ?? Math.max(row.totalArticles - row.indexedArticles, 0)
}

function rowCoverage(row: ResearchLibraryTopicCoverageRow) {
  if (typeof row.coveragePercent === "number") return Math.round(row.coveragePercent)
  if (row.totalArticles <= 0) return 0
  return Math.round((row.indexedArticles / row.totalArticles) * 100)
}

function coverageStatus(percent: number) {
  if (percent >= 90) return "healthy"
  if (percent >= 70) return "partial"
  return "stale"
}

function statusColor(status: string | undefined, percent: number) {
  const normalized = status?.toLowerCase()
  if (normalized === "healthy" || normalized === "success") return "#4af0c4"
  if (normalized === "failed" || normalized === "failure") return "#ff6b6b"
  if (normalized === "stale" || normalized === "warning" || normalized === "partial") return "#f5c542"
  return toneColor(percent >= 90 ? "good" : percent >= 70 ? "warn" : "bad")
}

function statusTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "success" || normalized === "healthy") return "#4af0c4"
  if (normalized === "failure" || normalized === "failed") return "#ff6b6b"
  if (normalized === "running") return "var(--accent)"
  return "#f5c542"
}

function labelForMode(mode: ReindexMode) {
  if (mode === "missing") return "Missing article reindex"
  if (mode === "recent") return "Recent article reindex"
  return "Full index rebuild"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatDate(value?: string | Date | null) {
  if (!value) return "never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unknown"
  return date.toLocaleString()
}

function toneColor(tone: "good" | "warn" | "bad") {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  return "#ff6b6b"
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 14,
}

const noticeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1px solid",
  borderRadius: 6,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const noticeCloseStyle: CSSProperties = {
  padding: "4px 7px",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
}

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
}

const summaryCellStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 12,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const actionRailStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  padding: 14,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const panelTitleStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.2px",
}

const railCopyStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.5,
}

const buttonRailStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
}

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 14,
  alignItems: "start",
}

const panelStyle: CSSProperties = {
  minWidth: 0,
  padding: 14,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
}

const topicHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr repeat(5, minmax(74px, 0.7fr))",
  gap: 8,
  minWidth: 680,
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.7px",
  textTransform: "uppercase",
}

const topicRowStyle: CSSProperties = {
  ...topicHeaderStyle,
  color: "var(--text)",
  textTransform: "none",
  letterSpacing: 0,
  fontSize: 10,
  alignItems: "center",
}

const topicNameStyle: CSSProperties = {
  color: "var(--accent)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const barTrackStyle: CSSProperties = {
  display: "inline-block",
  width: 42,
  height: 5,
  marginRight: 7,
  background: "rgba(255,255,255,0.08)",
  borderRadius: 999,
  overflow: "hidden",
  verticalAlign: "middle",
}

const barFillStyle: CSSProperties = {
  display: "block",
  height: "100%",
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 520,
  overflowY: "auto",
}

const itemStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const itemTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: 13,
  lineHeight: 1.35,
}

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.55,
}

const footnoteStyle: CSSProperties = {
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const queryFormStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(120px, 0.2fr)",
  gap: 8,
}

const inputStyle: CSSProperties = {
  minWidth: 0,
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  padding: "10px 12px",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  outline: "none",
}

const baseButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: "8px 10px",
  borderRadius: 4,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
}

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  color: "#000",
}

const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--accent)",
}

const dangerButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "transparent",
  border: "1px solid #ff6b6b",
  color: "#ff6b6b",
}

const resultStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
  padding: 12,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const resultMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const citationGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
}

const citationStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 10,
  background: "rgba(74,240,196,0.06)",
  border: "1px solid rgba(74,240,196,0.16)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const emptyStyle: CSSProperties = {
  padding: 16,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

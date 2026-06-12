"use client"

import type { CSSProperties } from "react"
import { useState } from "react"

export type FetchNewsSource = {
  id: string
  name: string
  topic: string
  url: string
  enabled: boolean
  priority: number
  fetchIntervalMinutes: number
  lastFetched: string | null
  lastStatus: string | null
  failCount: number
  lastErrorAt: string | null
  lastErrorMessage: string | null
  isDue: boolean
}

export type FetchNewsTopicRow = {
  topic: string
  total: number
  enabled: number
  due: number
  failed: number
  disabled: number
}

export type FetchNewsRoomData = {
  totals: {
    sources: number
    enabled: number
    disabled: number
    due: number
    failed: number
    neverFetched: number
  }
  autoSync: {
    appIntervalLabel: string
    sourceIntervalLabel: string
    note: string
  }
  topicRows: FetchNewsTopicRow[]
  dueSources: FetchNewsSource[]
  failedSources: FetchNewsSource[]
  recentSources: FetchNewsSource[]
  recommendations: string[]
}

type SyncResult = {
  success?: boolean
  saved?: number
  skipped?: number
  total?: number
  message?: string
  sources?: {
    ok?: number
    failed?: number
  }
}

export default function FetchNewsRoomModule({
  data,
  syncEndpoint = "/api/admin/sync",
}: {
  data: FetchNewsRoomData
  syncEndpoint?: string
}) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSync() {
    setSyncing(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch(syncEndpoint, { method: "POST" })
      const payload = (await response.json().catch(() => ({}))) as SyncResult & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Sync request failed.")
      }

      setResult(payload)
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync request failed.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={shellStyle}>
      <header style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>FETCH NEWS OFFICE</div>
          <h2 style={titleStyle}>RSS ingestion and auto-sync control</h2>
          <p style={copyStyle}>
            Run source fetches, inspect feed health, and decide which ingestion
            issues need cleanup before the newsroom cycle starts.
          </p>
        </div>
        <button
          type="button"
          onClick={runSync}
          disabled={syncing}
          style={{
            ...primaryButtonStyle,
            opacity: syncing ? 0.65 : 1,
            cursor: syncing ? "wait" : "pointer",
          }}
        >
          {syncing ? "SYNCING..." : "RUN NEWS SYNC"}
        </button>
      </header>

      <section style={metricGridStyle}>
        <Metric label="Enabled Sources" value={data.totals.enabled} tone="good" />
        <Metric label="Due Now" value={data.totals.due} tone={data.totals.due > 0 ? "warn" : "good"} />
        <Metric label="Failed" value={data.totals.failed} tone={data.totals.failed > 0 ? "bad" : "good"} />
        <Metric label="Disabled" value={data.totals.disabled} tone={data.totals.disabled > 0 ? "warn" : "neutral"} />
        <Metric label="Never Fetched" value={data.totals.neverFetched} tone={data.totals.neverFetched > 0 ? "warn" : "good"} />
      </section>

      {(result || error) && (
        <div style={noticeStyle(error ? "bad" : result?.success === false ? "warn" : "good")}>
          {error
            ? error
            : result?.message ||
              `Sync complete. Saved ${result?.saved ?? 0}, skipped ${result?.skipped ?? 0}, fetched ${result?.total ?? 0}. Sources ok ${result?.sources?.ok ?? 0}, failed ${result?.sources?.failed ?? 0}.`}
        </div>
      )}

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>AUTO SYNC</span>
            <span>{data.autoSync.appIntervalLabel}</span>
          </div>
          <div style={autoSyncGridStyle}>
            <InfoRow label="Source interval" value={data.autoSync.sourceIntervalLabel} />
            <InfoRow label="Behavior" value={data.autoSync.note} />
            <InfoRow label="Manual action" value={data.totals.due > 0 ? `${data.totals.due} sources ready` : "No sources due yet"} />
          </div>
        </article>

        <article style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>SUGGESTED NEXT MOVES</span>
            <span>{data.recommendations.length}</span>
          </div>
          <div style={listStyle}>
            {data.recommendations.map((item) => (
              <div key={item} style={suggestionStyle}>{item}</div>
            ))}
          </div>
        </article>
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span>TOPIC SOURCE COVERAGE</span>
          <span>{data.topicRows.length} TOPICS</span>
        </div>
        <div style={tableStyle}>
          <div style={{ ...rowStyle, ...headRowStyle }}>
            <span>Topic</span>
            <span>Total</span>
            <span>Enabled</span>
            <span>Due</span>
            <span>Failed</span>
            <span>Disabled</span>
          </div>
          {data.topicRows.map((row) => (
            <div key={row.topic} style={rowStyle}>
              <strong>{row.topic}</strong>
              <span>{row.total}</span>
              <span style={{ color: "#4af0c4" }}>{row.enabled}</span>
              <span style={{ color: row.due > 0 ? "#f5c542" : "var(--muted)" }}>{row.due}</span>
              <span style={{ color: row.failed > 0 ? "#ff6b6b" : "var(--muted)" }}>{row.failed}</span>
              <span>{row.disabled}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={threeColumnStyle}>
        <SourceList title="Due Sources" sources={data.dueSources} empty="No enabled sources are due right now." />
        <SourceList title="Failed / Disabled" sources={data.failedSources} empty="No source needs attention." />
        <SourceList title="Recently Fetched" sources={data.recentSources} empty="No source has fetched yet." />
      </section>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: "neutral" | "good" | "warn" | "bad"
}) {
  return (
    <div style={metricStyle}>
      <span>{label}</span>
      <strong style={{ color: toneColor(tone) }}>{value}</strong>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SourceList({
  title,
  sources,
  empty,
}: {
  title: string
  sources: FetchNewsSource[]
  empty: string
}) {
  return (
    <article style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span>{title}</span>
        <span>{sources.length}</span>
      </div>
      <div style={listStyle}>
        {sources.map((source) => (
          <div key={source.id} style={sourceItemStyle}>
            <strong>{source.name}</strong>
            <span>{source.topic} / {source.enabled ? "enabled" : "disabled"} / {source.lastStatus ?? "new"}</span>
            {source.lastErrorMessage && <em>{source.lastErrorMessage}</em>}
          </div>
        ))}
        {sources.length === 0 && <div style={emptyStyle}>{empty}</div>}
      </div>
    </article>
  )
}

function toneColor(tone: "neutral" | "good" | "warn" | "bad") {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  if (tone === "bad") return "#ff6b6b"
  return "var(--accent)"
}

function noticeStyle(tone: "good" | "warn" | "bad"): CSSProperties {
  const color = toneColor(tone)
  return {
    padding: "11px 12px",
    border: `1px solid ${color}55`,
    background: `${color}14`,
    borderRadius: 6,
    color,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    lineHeight: 1.5,
  }
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  marginBottom: 18,
}

const heroStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 240px)",
  gap: 18,
  alignItems: "end",
}

const eyebrowStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.4px",
  marginBottom: 8,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display)",
  fontSize: 26,
  lineHeight: 1.15,
}

const copyStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
  maxWidth: 720,
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: "10px 14px",
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 5,
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
}

const metricStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minHeight: 72,
  padding: 12,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
}

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(240px, 1fr))",
  gap: 12,
}

const threeColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
  gap: 12,
}

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 14,
}

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 12,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const autoSyncGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const infoRowStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const suggestionStyle: CSSProperties = {
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontSize: 12,
  lineHeight: 1.45,
}

const tableStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  overflowX: "auto",
}

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(130px, 1.2fr) repeat(5, minmax(70px, 0.6fr))",
  minWidth: 620,
  gap: 8,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase",
}

const headRowStyle: CSSProperties = {
  background: "transparent",
  color: "var(--muted)",
  borderColor: "transparent",
}

const sourceItemStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontSize: 12,
  lineHeight: 1.4,
}

const emptyStyle: CSSProperties = {
  padding: 16,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "center",
}

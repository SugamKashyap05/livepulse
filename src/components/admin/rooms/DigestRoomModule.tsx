/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"

export type DigestStatus = "draft" | "generating" | "ready" | "published" | "failed" | "empty" | string

export type DigestToday = {
  id?: string | null
  date: string
  status: DigestStatus
  title?: string | null
  preview?: string | null
  model?: string | null
  generatedAt?: string | Date | null
  updatedAt?: string | Date | null
  includedCount?: number | null
  error?: string | null
  publicUrl?: string | null
}

export type DigestHistoryRow = {
  id: string
  date: string
  status: DigestStatus
  title?: string | null
  preview?: string | null
  model?: string | null
  generatedAt?: string | Date | null
  includedCount?: number | null
  publicUrl?: string | null
}

export type DigestIncludedArticleRow = {
  id: string
  title: string
  topic?: string | null
  sourceName?: string | null
  publishedAt?: string | Date | null
  score?: number | null
  reason?: string | null
  publicUrl?: string | null
}

export type DigestPublicVisibility = {
  isPublic: boolean
  publicUrl?: string | null
  route?: string | null
  lastPublishedAt?: string | Date | null
  robotsAllowed?: boolean | null
  notes?: string | null
}

export type DigestRoomModuleProps = {
  today: DigestToday
  historyRows: DigestHistoryRow[]
  includedArticles: DigestIncludedArticleRow[]
  visibility: DigestPublicVisibility
  onGenerate?: () => void | Promise<void>
  onRegenerate?: (digestId?: string | null) => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  generateEndpoint?: string
  regenerateEndpoint?: string
  generatePayload?: Record<string, unknown>
  regeneratePayload?: Record<string, unknown>
}

type Notice = {
  tone: "good" | "warn" | "bad"
  text: string
} | null

type DigestAction = "generate" | "regenerate"

export default function DigestRoomModule({
  today,
  historyRows,
  includedArticles,
  visibility,
  onGenerate,
  onRegenerate,
  onRefresh,
  generateEndpoint = "/api/admin/digest/generate",
  regenerateEndpoint = "/api/admin/digest/regenerate",
  generatePayload,
  regeneratePayload,
}: DigestRoomModuleProps) {
  const [working, setWorking] = useState<DigestAction | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [prevHistoryRows, setPrevHistoryRows] = useState(historyRows)
  const [history, setHistory] = useState(historyRows)
  if (historyRows !== prevHistoryRows) {
    setPrevHistoryRows(historyRows)
    setHistory(historyRows)
  }

  const [prevIncludedArticles, setPrevIncludedArticles] = useState(includedArticles)
  const [articles, setArticles] = useState(includedArticles)
  if (includedArticles !== prevIncludedArticles) {
    setPrevIncludedArticles(includedArticles)
    setArticles(includedArticles)
  }

  const sortedHistory = useMemo(() => [...history].sort((a, b) => digestTime(b) - digestTime(a)), [history])
  const sortedArticles = useMemo(() => [...articles].sort((a, b) => articleScore(b) - articleScore(a)), [articles])
  const publicLabel = visibility.isPublic ? "Visible" : "Private"
  const publicDigestUrl = today.publicUrl ?? visibility.publicUrl ?? null

  async function runAction(action: DigestAction) {
    if (action === "regenerate" && !confirm("Regenerate today's digest and replace its current preview?")) return

    setWorking(action)
    setNotice(null)
    try {
      if (action === "generate" && onGenerate) {
        await onGenerate()
      } else if (action === "regenerate" && onRegenerate) {
        await onRegenerate(today.id)
      } else {
        const endpoint = action === "generate" ? generateEndpoint : regenerateEndpoint
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "generate"
              ? generatePayload ?? { id: today.id, date: today.date }
              : regeneratePayload ?? { id: today.id, date: today.date }
          ),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `${labelForAction(action)} failed`)
      }

      setNotice({ tone: "good", text: `${labelForAction(action)} queued successfully.` })
      await onRefresh?.()
    } catch (error) {
      console.error(`[digest room ${action}]`, error)
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : `${labelForAction(action)} failed.` })
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
        <MetricCard label="Today" value={today.status.toUpperCase()} detail={today.date} tone={statusToneName(today.status)} />
        <MetricCard label="Included" value={formatNumber(today.includedCount ?? articles.length)} detail="articles in digest" />
        <MetricCard label="Visibility" value={publicLabel} detail={visibility.route ?? visibility.publicUrl ?? "no public route"} tone={visibility.isPublic ? "good" : "warn"} />
        <MetricCard label="Model" value={today.model ?? "N/A"} detail={`generated ${formatDate(today.generatedAt ?? today.updatedAt)}`} />
      </div>

      <section style={heroPanelStyle}>
        <div style={heroCopyStyle}>
          <div style={panelTitleStyle}>DIGEST ROOM</div>
          <h2 style={digestTitleStyle}>{today.title ?? `Daily digest for ${today.date}`}</h2>
          <p style={digestPreviewStyle}>
            {today.error ? `Generation error: ${today.error}` : today.preview ?? "No digest preview has been generated for today."}
          </p>
          <div style={metaRowStyle}>
            <span style={{ color: statusColor(today.status) }}>{today.status.toUpperCase()}</span>
            <span>{today.model ?? "model pending"}</span>
            <span>{formatDate(today.generatedAt ?? today.updatedAt)}</span>
          </div>
        </div>
        <div style={heroActionsStyle}>
          <button
            type="button"
            disabled={working !== null}
            onClick={() => runAction("generate")}
            style={buttonStateStyle(primaryButtonStyle, working !== null, working === "generate")}
          >
            {working === "generate"
              ? "PUBLISHING..."
              : today.id
                ? "PUBLISH UPDATE"
                : "PUBLISH TODAY"}
          </button>
          <button
            type="button"
            disabled={working !== null || !today.id}
            onClick={() => runAction("regenerate")}
            style={buttonStateStyle(secondaryButtonStyle, working !== null || !today.id, working === "regenerate")}
          >
            {working === "regenerate" ? "REGENERATING..." : "REGENERATE"}
          </button>
          {publicDigestUrl && (
            <a href={publicDigestUrl} target="_blank" rel="noreferrer" style={viewLinkStyle}>
              VIEW PUBLIC DIGEST
            </a>
          )}
          {onRefresh && (
            <button
              type="button"
              disabled={working !== null}
              onClick={() => onRefresh()}
              style={buttonStateStyle(ghostButtonStyle, working !== null)}
            >
              REFRESH
            </button>
          )}
        </div>
      </section>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>INCLUDED ARTICLES</span>
            <span>{sortedArticles.length}</span>
          </div>
          <div style={listStyle}>
            {sortedArticles.map((article) => (
              <article key={article.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: "#4af0c4" }}>{article.topic ?? "general"}</span>
                  <span>{article.sourceName ?? "unknown source"}</span>
                  <span>{formatDate(article.publishedAt)}</span>
                  {typeof article.score === "number" && <span>score {article.score.toFixed(1)}</span>}
                </div>
                <h3 style={itemTitleStyle}>{article.title}</h3>
                <p style={descriptionStyle}>{article.reason ?? "Selected for today's editorial digest."}</p>
                {article.publicUrl && (
                  <a href={article.publicUrl} target="_blank" rel="noreferrer" style={inlineLinkStyle}>
                    OPEN ARTICLE
                  </a>
                )}
              </article>
            ))}
            {sortedArticles.length === 0 && <div style={emptyStyle}>No included article rows supplied.</div>}
          </div>
        </section>

        <section style={sideStackStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <span>PUBLIC VISIBILITY</span>
              <span style={{ color: visibility.isPublic ? "#4af0c4" : "#f5c542" }}>{publicLabel.toUpperCase()}</span>
            </div>
            <div style={visibilityGridStyle}>
              <InfoRow label="Route" value={visibility.route ?? "not configured"} />
              <InfoRow label="Public URL" value={visibility.publicUrl ?? "not published"} href={visibility.publicUrl ?? undefined} />
              <InfoRow label="Last Published" value={formatDate(visibility.lastPublishedAt)} />
              <InfoRow label="Robots" value={visibility.robotsAllowed === false ? "blocked" : visibility.robotsAllowed === true ? "allowed" : "unknown"} tone={visibility.robotsAllowed === false ? "bad" : "good"} />
            </div>
            {visibility.notes && <p style={visibilityNoteStyle}>{visibility.notes}</p>}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <span>DIGEST HISTORY</span>
              <span>{sortedHistory.length}</span>
            </div>
            <div style={historyListStyle}>
              {sortedHistory.map((digest) => (
                <article key={digest.id} style={historyItemStyle}>
                  <div style={historyHeaderStyle}>
                    <span>{digest.date}</span>
                    <span style={{ color: statusColor(digest.status) }}>{digest.status.toUpperCase()}</span>
                  </div>
                  <h3 style={historyTitleStyle}>{digest.title ?? "Untitled digest"}</h3>
                  <p style={historyPreviewStyle}>{digest.preview ?? "No preview saved."}</p>
                  <div style={metaRowStyle}>
                    <span>{digest.model ?? "model n/a"}</span>
                    <span>{formatNumber(digest.includedCount ?? 0)} articles</span>
                    <span>{formatDate(digest.generatedAt)}</span>
                  </div>
                  {digest.publicUrl && (
                    <a href={digest.publicUrl} target="_blank" rel="noreferrer" style={inlineLinkStyle}>
                      PUBLIC URL
                    </a>
                  )}
                </article>
              ))}
              {sortedHistory.length === 0 && <div style={emptyStyle}>No digest history yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
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

function InfoRow({
  label,
  value,
  href,
  tone,
}: {
  label: string
  value: string
  href?: string
  tone?: "good" | "warn" | "bad"
}) {
  return (
    <div style={infoRowStyle}>
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={infoLinkStyle}>
          {value}
        </a>
      ) : (
        <strong style={{ color: tone ? toneColor(tone) : "var(--text)" }}>{value}</strong>
      )}
    </div>
  )
}

function digestTime(digest: DigestHistoryRow) {
  const value = digest.generatedAt ?? digest.date
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function articleScore(article: DigestIncludedArticleRow) {
  return typeof article.score === "number" ? article.score : 0
}

function labelForAction(action: DigestAction) {
  return action === "generate" ? "Digest generation" : "Digest regeneration"
}

function statusToneName(status: string): "good" | "warn" | "bad" {
  const normalized = status.toLowerCase()
  if (normalized === "published" || normalized === "ready") return "good"
  if (normalized === "failed") return "bad"
  return "warn"
}

function statusColor(status: string) {
  return toneColor(statusToneName(status))
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

function buttonStateStyle(base: CSSProperties, disabled: boolean, active = false): CSSProperties {
  return {
    ...base,
    opacity: disabled && !active ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  }
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
  gap: 10,
  minWidth: 0,
}

const summaryCellStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  padding: 12,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const heroPanelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: 16,
  alignItems: "start",
  minWidth: 0,
  padding: 16,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const heroCopyStyle: CSSProperties = {
  minWidth: 0,
}

const panelTitleStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.2px",
}

const digestTitleStyle: CSSProperties = {
  margin: "8px 0 8px",
  color: "var(--text)",
  fontSize: 20,
  lineHeight: 1.25,
  overflowWrap: "anywhere",
}

const digestPreviewStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
}

const heroActionsStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
}

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
  gap: 14,
  alignItems: "start",
  minWidth: 0,
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

const sideStackStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  minWidth: 0,
}

const listStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 720,
  overflowY: "auto",
  minWidth: 0,
}

const itemStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
  padding: 12,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 9,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const itemTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
}

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.55,
  overflowWrap: "anywhere",
}

const visibilityGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const infoRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px minmax(0, 1fr)",
  gap: 10,
  alignItems: "baseline",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const infoLinkStyle: CSSProperties = {
  color: "var(--accent)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textDecoration: "none",
}

const visibilityNoteStyle: CSSProperties = {
  margin: "12px 0 0",
  paddingTop: 12,
  borderTop: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.5,
}

const historyListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 500,
  overflowY: "auto",
  minWidth: 0,
}

const historyItemStyle: CSSProperties = {
  ...itemStyle,
  gap: 7,
}

const historyHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const historyTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: 13,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
}

const historyPreviewStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.5,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
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

const ghostButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
}

const viewLinkStyle: CSSProperties = {
  ...baseButtonStyle,
  display: "grid",
  placeItems: "center",
  background: "rgba(74,240,196,0.08)",
  border: "1px solid rgba(74,240,196,0.28)",
  color: "#4af0c4",
  textDecoration: "none",
}

const inlineLinkStyle: CSSProperties = {
  justifySelf: "start",
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textDecoration: "none",
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

"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"

export type PublishingDeskReport = {
  id: string
  title: string
  description?: string | null
  topic?: string | null
  image?: string | null
  sourceName?: string | null
  sourceUrl?: string | null
  fetchedAt?: string | Date | null
  pubDate?: string | Date | null
  createdAt?: string | Date | null
  published?: boolean
  factScore?: number | null
  biasAnalysis?: string | null
  summary?: string | null
  publicUrl?: string | null
}

export type PublishingDeskModuleProps = {
  pendingDrafts: PublishingDeskReport[]
  publishedReports: PublishingDeskReport[]
  publicBasePath?: string
  onRefresh?: () => void | Promise<void>
}

type Notice = {
  tone: "good" | "warn" | "bad"
  text: string
  href?: string
} | null

type ActionName = "publish" | "discard" | "reanalyse" | "unpublish"

export default function PublishingDeskModule({
  pendingDrafts,
  publishedReports,
  publicBasePath = "/ai-news",
  onRefresh,
}: PublishingDeskModuleProps) {
  const [prevPendingDrafts, setPrevPendingDrafts] = useState(pendingDrafts)
  const [pending, setPending] = useState(pendingDrafts)
  if (pendingDrafts !== prevPendingDrafts) {
    setPrevPendingDrafts(pendingDrafts)
    setPending(pendingDrafts)
  }

  const [prevPublishedReports, setPrevPublishedReports] = useState(publishedReports)
  const [published, setPublished] = useState(publishedReports)
  if (publishedReports !== prevPublishedReports) {
    setPrevPublishedReports(publishedReports)
    setPublished(publishedReports)
  }

  const [working, setWorking] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const sortedPending = useMemo(() => sortReports(pending), [pending])
  const sortedPublished = useMemo(() => sortReports(published), [published])

  async function runAction(action: ActionName, report: PublishingDeskReport) {
    if (action === "discard" && !confirm("Discard this AI draft permanently? This cannot be undone.")) {
      return
    }

    if (action === "unpublish" && !confirm("Unpublish this report from the public site?")) {
      return
    }

    const key = `${action}:${report.id}`
    setWorking(key)
    try {
      const endpoint = `/api/admin/ai/${action}`
      const res = await fetch(endpoint, {
        method: action === "discard" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice({
          tone: "bad",
          text: typeof data.error === "string" ? data.error : `${labelForAction(action)} failed.`,
        })
        return
      }

      applyLocalResult(action, report, data)
      await onRefresh?.()
      setNotice(successNotice(action, report, publicUrl(report, publicBasePath)))
    } catch (error) {
      console.error(`[publishing desk ${action}]`, error)
      setNotice({ tone: "bad", text: `${labelForAction(action)} failed.` })
    } finally {
      setWorking(null)
    }
  }

  function applyLocalResult(
    action: ActionName,
    report: PublishingDeskReport,
    data: { factScore?: number | null; biasAnalysis?: string | null }
  ) {
    if (action === "publish") {
      setPending((items) => items.filter((item) => item.id !== report.id))
      setPublished((items) => sortReports([{ ...report, published: true }, ...items]))
      return
    }

    if (action === "discard") {
      setPending((items) => items.filter((item) => item.id !== report.id))
      return
    }

    if (action === "unpublish") {
      setPublished((items) => items.filter((item) => item.id !== report.id))
      setPending((items) => sortReports([{ ...report, published: false }, ...items]))
      return
    }

    setPending((items) =>
      items.map((item) =>
        item.id === report.id
          ? {
              ...item,
              factScore: data.factScore ?? item.factScore ?? null,
              biasAnalysis: data.biasAnalysis ?? item.biasAnalysis ?? null,
            }
          : item
      )
    )
  }

  return (
    <section style={shellStyle}>
      {notice && (
        <div style={{ ...noticeStyle, borderColor: toneColor(notice.tone) }}>
          <span>{notice.text}</span>
          {notice.href && (
            <a href={notice.href} target="_blank" rel="noreferrer" style={noticeLinkStyle}>
              VIEW
            </a>
          )}
          <button type="button" onClick={() => setNotice(null)} style={noticeCloseStyle}>
            CLOSE
          </button>
        </div>
      )}

      <div style={summaryGridStyle}>
        <div style={summaryCellStyle}>
          <span>Pending Drafts</span>
          <strong style={{ color: pending.length > 0 ? "#f5c542" : "#4af0c4" }}>{pending.length}</strong>
        </div>
        <div style={summaryCellStyle}>
          <span>Published AI Reports</span>
          <strong style={{ color: "#4af0c4" }}>{published.length}</strong>
        </div>
        <div style={summaryCellStyle}>
          <span>Public Route</span>
          <strong>{publicBasePath}</strong>
        </div>
      </div>

      <div style={deskGridStyle}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>PENDING AI DRAFTS</span>
            <span>{sortedPending.length}</span>
          </div>
          <div style={listStyle}>
            {sortedPending.map((report) => (
              <article key={report.id} style={itemStyle}>
                <ReportBody report={report} publicBasePath={publicBasePath} status="Draft" />
                <div style={buttonGridStyle}>
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={() => runAction("reanalyse", report)}
                    style={buttonStateStyle(secondaryButtonStyle, working !== null, working === `reanalyse:${report.id}`)}
                  >
                    {working === `reanalyse:${report.id}` ? "ANALYSING..." : "REANALYSE"}
                  </button>
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={() => runAction("publish", report)}
                    style={buttonStateStyle(primaryButtonStyle, working !== null, working === `publish:${report.id}`)}
                  >
                    {working === `publish:${report.id}` ? "PUBLISHING..." : "PUBLISH"}
                  </button>
                  <button
                    type="button"
                    disabled={working !== null}
                    onClick={() => runAction("discard", report)}
                    style={buttonStateStyle(dangerButtonStyle, working !== null, working === `discard:${report.id}`)}
                  >
                    {working === `discard:${report.id}` ? "DISCARDING..." : "DISCARD"}
                  </button>
                </div>
              </article>
            ))}
            {sortedPending.length === 0 && <div style={emptyStyle}>No AI drafts waiting for publication.</div>}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>PUBLISHED REPORTS</span>
            <span>{sortedPublished.length}</span>
          </div>
          <div style={listStyle}>
            {sortedPublished.map((report) => {
              const href = publicUrl(report, publicBasePath)
              return (
                <article key={report.id} style={itemStyle}>
                  <ReportBody report={report} publicBasePath={publicBasePath} status="Live" />
                  <div style={publishedActionStyle}>
                    <a href={href} target="_blank" rel="noreferrer" style={viewLinkStyle}>
                      PUBLIC URL
                    </a>
                    <button
                      type="button"
                      disabled={working !== null}
                      onClick={() => runAction("unpublish", report)}
                      style={buttonStateStyle(dangerButtonStyle, working !== null, working === `unpublish:${report.id}`)}
                    >
                      {working === `unpublish:${report.id}` ? "UNPUBLISHING..." : "UNPUBLISH"}
                    </button>
                  </div>
                </article>
              )
            })}
            {sortedPublished.length === 0 && <div style={emptyStyle}>No published AI reports yet.</div>}
          </div>
        </div>
      </div>
    </section>
  )
}

function ReportBody({
  report,
  publicBasePath,
  status,
}: {
  report: PublishingDeskReport
  publicBasePath: string
  status: "Draft" | "Live"
}) {
  const href = publicUrl(report, publicBasePath)
  return (
    <div>
      <div style={metaRowStyle}>
        <span style={{ color: status === "Live" ? "#4af0c4" : "#f5c542" }}>{status.toUpperCase()}</span>
        <span>{report.topic ?? "general"}</span>
        <span>{formatDate(report.pubDate ?? report.fetchedAt ?? report.createdAt)}</span>
      </div>
      <h3 style={titleStyle}>{report.title}</h3>
      <p style={descriptionStyle}>{report.summary ?? report.description ?? "No description supplied."}</p>
      <div style={statusRowStyle}>
        <span>URL: {href}</span>
        <span style={{ color: scoreColor(report.factScore) }}>
          FACT: {typeof report.factScore === "number" ? `${report.factScore}/100` : "N/A"}
        </span>
      </div>
      {report.biasAnalysis && <div style={biasStyle}>BIAS: {report.biasAnalysis}</div>}
    </div>
  )
}

function publicUrl(report: PublishingDeskReport, publicBasePath: string) {
  return report.publicUrl || `${publicBasePath.replace(/\/$/, "")}/${report.id}`
}

function sortReports(items: PublishingDeskReport[]) {
  return [...items].sort((a, b) => reportTime(b) - reportTime(a))
}

function reportTime(report: PublishingDeskReport) {
  const value = report.pubDate ?? report.fetchedAt ?? report.createdAt
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatDate(value?: string | Date | null) {
  if (!value) return "undated"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "undated"
  return date.toLocaleString()
}

function scoreColor(score?: number | null) {
  if (typeof score !== "number") return "var(--muted)"
  if (score >= 80) return "#4af0c4"
  if (score >= 60) return "#f5c542"
  return "#ff6b6b"
}

function toneColor(tone: NonNullable<Notice>["tone"]) {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  return "#ff6b6b"
}

function labelForAction(action: ActionName) {
  if (action === "publish") return "Publish"
  if (action === "discard") return "Discard"
  if (action === "reanalyse") return "Reanalyse"
  return "Unpublish"
}

function successNotice(action: ActionName, report: PublishingDeskReport, href: string): Notice {
  if (action === "publish") {
    return { tone: "good", text: "Report published to the public site.", href }
  }
  if (action === "discard") return { tone: "warn", text: "Draft discarded." }
  if (action === "reanalyse") return { tone: "good", text: "Draft reanalysed." }
  return { tone: "warn", text: "Report unpublished and returned to drafts." }
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

const noticeLinkStyle: CSSProperties = {
  color: "var(--accent)",
  fontWeight: 700,
  textDecoration: "none",
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
  gap: 7,
  padding: 12,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const deskGridStyle: CSSProperties = {
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

const listStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 680,
  overflowY: "auto",
}

const itemStyle: CSSProperties = {
  display: "grid",
  gap: 12,
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

const titleStyle: CSSProperties = {
  margin: "7px 0 5px",
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.35,
}

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.55,
}

const statusRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 9,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const biasStyle: CSSProperties = {
  marginTop: 7,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  lineHeight: 1.5,
}

const buttonGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
  gap: 8,
}

const publishedActionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr minmax(120px, 0.7fr)",
  gap: 8,
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

const viewLinkStyle: CSSProperties = {
  ...baseButtonStyle,
  display: "grid",
  placeItems: "center",
  background: "rgba(74,240,196,0.08)",
  border: "1px solid rgba(74,240,196,0.28)",
  color: "#4af0c4",
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

"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"

export type VerificationQueueRow = {
  id: string
  title: string
  topic?: string | null
  sourceName?: string | null
  queuedAt?: string | Date | null
  priority?: "low" | "normal" | "high" | "urgent" | string | null
  status?: "queued" | "running" | "needs-review" | "failed" | string
}

export type VerificationLowScoreDraft = {
  id: string
  title: string
  factScore?: number | null
  biasAnalysis?: string | null
  sourceName?: string | null
  updatedAt?: string | Date | null
}

export type VerificationFailedJob = {
  id: string
  title: string
  error?: string | null
  failedAt?: string | Date | null
  attempts?: number | null
}

export type VerificationWarning = {
  id: string
  title: string
  detail?: string | null
  severity: "low" | "medium" | "high" | "critical" | string
  draftId?: string | null
}

export type VerificationDuplicateWarning = {
  id: string
  title: string
  sourceName?: string | null
  duplicateOf?: string | null
  similarity?: number | null
  detail?: string | null
}

export type VerificationRoomModuleProps = {
  factCheckQueue: VerificationQueueRow[]
  lowFactScoreDrafts: VerificationLowScoreDraft[]
  failedVerificationJobs: VerificationFailedJob[]
  suspiciousDraftWarnings: VerificationWarning[]
  duplicateSourceWarnings: VerificationDuplicateWarning[]
  onRunFactCheck?: () => void | Promise<void>
  onReanalyse?: () => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  factCheckEndpoint?: string
  reanalyseEndpoint?: string
  factCheckPayload?: Record<string, unknown>
  reanalysePayload?: Record<string, unknown>
}

type VerificationAction = "fact-check" | "reanalyse"

type Notice = {
  tone: "good" | "warn" | "bad"
  text: string
} | null

export default function VerificationRoomModule({
  factCheckQueue,
  lowFactScoreDrafts,
  failedVerificationJobs,
  suspiciousDraftWarnings,
  duplicateSourceWarnings,
  onRunFactCheck,
  onReanalyse,
  onRefresh,
  factCheckEndpoint = "/api/admin/ai/jobs",
  reanalyseEndpoint = "/api/admin/ai/jobs",
  factCheckPayload,
  reanalysePayload,
}: VerificationRoomModuleProps) {
  const [working, setWorking] = useState<VerificationAction | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const sortedQueue = useMemo(
    () =>
      [...factCheckQueue].sort((a, b) => {
        const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority)
        if (priorityDelta !== 0) return priorityDelta
        return dateValue(a.queuedAt) - dateValue(b.queuedAt)
      }),
    [factCheckQueue]
  )
  const sortedLowScores = useMemo(() => [...lowFactScoreDrafts].sort((a, b) => scoreValue(a.factScore) - scoreValue(b.factScore)), [lowFactScoreDrafts])
  const warningCount = suspiciousDraftWarnings.length + duplicateSourceWarnings.length

  async function runAction(action: VerificationAction) {
    setWorking(action)
    setNotice(null)
    try {
      if (action === "fact-check" && onRunFactCheck) {
        await onRunFactCheck()
      } else if (action === "reanalyse" && onReanalyse) {
        await onReanalyse()
      } else {
        const endpoint = action === "fact-check" ? factCheckEndpoint : reanalyseEndpoint
        const payload =
          action === "fact-check"
            ? factCheckPayload ?? { type: "newsroom_cycle", title: "Run verification cycle", params: {} }
            : reanalysePayload ?? { type: "newsroom_cycle", title: "Reanalyse drafts", params: {} }
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `${labelForAction(action)} failed`)
      }

      setNotice({ tone: "good", text: `${labelForAction(action)} queued successfully.` })
      await onRefresh?.()
    } catch (error) {
      console.error(`[verification room ${action}]`, error)
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
        <MetricCard label="Fact Queue" value={formatNumber(factCheckQueue.length)} detail="awaiting verification" tone={factCheckQueue.length > 0 ? "warn" : "good"} />
        <MetricCard label="Low Scores" value={formatNumber(lowFactScoreDrafts.length)} detail="drafts below threshold" tone={lowFactScoreDrafts.length > 0 ? "bad" : "good"} />
        <MetricCard label="Failed Jobs" value={formatNumber(failedVerificationJobs.length)} detail="need retry or triage" tone={failedVerificationJobs.length > 0 ? "bad" : "good"} />
        <MetricCard label="Warnings" value={formatNumber(warningCount)} detail="suspicious, duplicate, incomplete" tone={warningCount > 0 ? "warn" : "good"} />
      </div>

      <div style={actionRailStyle}>
        <div>
          <div style={panelTitleStyle}>VERIFICATION ROOM</div>
          <p style={railCopyStyle}>Fact-check queues, low-score drafts, verification failures, suspicious drafts, and duplicate source warnings.</p>
        </div>
        <div style={buttonRailStyle}>
          <ActionButton label="RUN FACT-CHECK" loading={working === "fact-check"} disabled={working !== null} onClick={() => runAction("fact-check")} />
          <ActionButton label="REANALYSE DRAFTS" loading={working === "reanalyse"} disabled={working !== null} onClick={() => runAction("reanalyse")} variant="secondary" />
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
            <span>FACT-CHECK QUEUE</span>
            <span>{sortedQueue.length}</span>
          </div>
          <div style={tableWrapStyle}>
            <div style={queueHeaderStyle}>
              <span>Draft</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Queued</span>
            </div>
            {sortedQueue.map((row) => (
              <div key={row.id} style={queueRowStyle}>
                <span>
                  <strong style={rowTitleStyle}>{row.title}</strong>
                  <small style={rowDetailStyle}>{row.topic ?? "general"} / {row.sourceName ?? "unknown source"}</small>
                </span>
                <span style={{ color: priorityColor(row.priority) }}>{(row.priority ?? "normal").toUpperCase()}</span>
                <span style={{ color: statusColor(row.status ?? "queued") }}>{(row.status ?? "queued").toUpperCase()}</span>
                <span>{formatDate(row.queuedAt)}</span>
              </div>
            ))}
            {sortedQueue.length === 0 && <div style={emptyStyle}>No fact-check queue rows supplied.</div>}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>LOW FACT-SCORE DRAFTS</span>
            <span>{sortedLowScores.length}</span>
          </div>
          <div style={listStyle}>
            {sortedLowScores.map((draft) => (
              <article key={draft.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: scoreColor(draft.factScore) }}>FACT {formatScore(draft.factScore)}</span>
                  <span>{draft.sourceName ?? "unknown source"}</span>
                  <span>{formatDate(draft.updatedAt)}</span>
                </div>
                <h3 style={itemTitleStyle}>{draft.title}</h3>
                <p style={descriptionStyle}>{draft.biasAnalysis ?? "No verification analysis has been attached yet."}</p>
              </article>
            ))}
            {sortedLowScores.length === 0 && <div style={emptyStyle}>No low fact-score drafts supplied.</div>}
          </div>
        </section>
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>FAILED VERIFICATION JOBS</span>
            <span>{failedVerificationJobs.length}</span>
          </div>
          <div style={listStyle}>
            {failedVerificationJobs.map((job) => (
              <article key={job.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: "#ff6b6b" }}>FAILED</span>
                  <span>{formatNumber(job.attempts ?? 0)} attempts</span>
                  <span>{formatDate(job.failedAt)}</span>
                </div>
                <h3 style={itemTitleStyle}>{job.title}</h3>
                <p style={descriptionStyle}>{job.error ?? "Verification worker failed without an error payload."}</p>
              </article>
            ))}
            {failedVerificationJobs.length === 0 && <div style={emptyStyle}>No failed verification jobs supplied.</div>}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>SUSPICIOUS / INCOMPLETE DRAFTS</span>
            <span>{suspiciousDraftWarnings.length}</span>
          </div>
          <div style={listStyle}>
            {suspiciousDraftWarnings.map((warning) => (
              <article key={warning.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: severityColor(warning.severity) }}>{warning.severity.toUpperCase()}</span>
                  {warning.draftId && <span>draft {warning.draftId}</span>}
                </div>
                <h3 style={itemTitleStyle}>{warning.title}</h3>
                <p style={descriptionStyle}>{warning.detail ?? "Draft needs editorial verification before publication."}</p>
              </article>
            ))}
            {suspiciousDraftWarnings.length === 0 && <div style={emptyStyle}>No suspicious or incomplete draft warnings supplied.</div>}
          </div>
        </section>
      </div>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span>DUPLICATE / SOURCE WARNINGS</span>
          <span>{duplicateSourceWarnings.length}</span>
        </div>
        <div style={duplicateGridStyle}>
          {duplicateSourceWarnings.map((warning) => (
            <article key={warning.id} style={itemStyle}>
              <div style={metaRowStyle}>
                <span style={{ color: "#f5c542" }}>{warning.sourceName ?? "SOURCE UNKNOWN"}</span>
                {typeof warning.similarity === "number" && <span>{formatSimilarity(warning.similarity)} similar</span>}
                {warning.duplicateOf && <span>matches {warning.duplicateOf}</span>}
              </div>
              <h3 style={itemTitleStyle}>{warning.title}</h3>
              <p style={descriptionStyle}>{warning.detail ?? "Potential duplicate or source collision detected."}</p>
            </article>
          ))}
          {duplicateSourceWarnings.length === 0 && <div style={emptyStyle}>No duplicate or source warnings supplied.</div>}
        </div>
      </section>
    </section>
  )
}

function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <div style={summaryCellStyle}>
      <span>{label}</span>
      <strong style={{ color: toneColor(tone) }}>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function ActionButton({ label, loading, disabled, onClick, variant = "primary" }: { label: string; loading: boolean; disabled: boolean; onClick: () => void; variant?: "primary" | "secondary" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={buttonStateStyle(variant === "primary" ? primaryButtonStyle : secondaryButtonStyle, disabled, loading)}
    >
      {loading ? "QUEUING..." : label}
    </button>
  )
}

function labelForAction(action: VerificationAction) {
  return action === "fact-check" ? "Fact-check" : "Reanalysis"
}

function dateValue(value?: string | Date | null) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
}

function scoreValue(value?: number | null) {
  return typeof value === "number" ? value : Number.MAX_SAFE_INTEGER
}

function priorityRank(priority?: string | null) {
  if (priority === "urgent") return 4
  if (priority === "high") return 3
  if (priority === "normal") return 2
  if (priority === "low") return 1
  return 0
}

function priorityColor(priority?: string | null) {
  if (priority === "urgent" || priority === "high") return "#ff6b6b"
  if (priority === "normal") return "#f5c542"
  return "#9fb0c5"
}

function statusColor(status: string) {
  if (status === "running") return "#4af0c4"
  if (status === "failed" || status === "needs-review") return "#ff6b6b"
  return "#f5c542"
}

function severityColor(severity: string) {
  if (severity === "critical" || severity === "high") return "#ff6b6b"
  if (severity === "medium") return "#f5c542"
  return "#9fb0c5"
}

function scoreColor(score?: number | null) {
  if (typeof score !== "number") return "#9fb0c5"
  if (score < 45) return "#ff6b6b"
  if (score < 70) return "#f5c542"
  return "#4af0c4"
}

function toneColor(tone: "good" | "warn" | "bad" | "neutral") {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  if (tone === "bad") return "#ff6b6b"
  return "#9fb0c5"
}

function buttonStateStyle(base: CSSProperties, disabled: boolean, active = false): CSSProperties {
  return {
    ...base,
    opacity: disabled && !active ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatScore(value?: number | null) {
  return typeof value === "number" ? value.toFixed(0) : "N/A"
}

function formatSimilarity(value: number) {
  const normalized = value > 1 ? value / 100 : value
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(normalized)
}

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
}

const shellStyle: CSSProperties = { display: "grid", gap: 18 }
const summaryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }
const summaryCellStyle: CSSProperties = { display: "grid", gap: 5, padding: 14, border: "1px solid rgba(148, 163, 184, 0.22)", background: "rgba(15, 23, 42, 0.72)", borderRadius: 8, color: "#cbd5e1" }
const actionRailStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: 16, border: "1px solid rgba(74, 240, 196, 0.18)", background: "rgba(2, 8, 23, 0.72)", borderRadius: 8, flexWrap: "wrap" }
const panelTitleStyle: CSSProperties = { color: "#4af0c4", fontSize: 12, fontWeight: 800, letterSpacing: 0 }
const railCopyStyle: CSSProperties = { margin: "6px 0 0", color: "#9fb0c5", maxWidth: 620, lineHeight: 1.5 }
const buttonRailStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" }
const mainGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }
const panelStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.18)", background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, overflow: "hidden" }
const panelHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderBottom: "1px solid rgba(148, 163, 184, 0.16)", color: "#e2e8f0", fontSize: 12, fontWeight: 800, letterSpacing: 0 }
const tableWrapStyle: CSSProperties = { display: "grid", overflowX: "auto" }
const queueHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 100px 120px 140px", gap: 12, minWidth: 680, padding: "10px 14px", color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }
const queueRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 100px 120px 140px", gap: 12, minWidth: 680, padding: "12px 14px", borderTop: "1px solid rgba(148, 163, 184, 0.12)", color: "#cbd5e1", alignItems: "center", fontSize: 13 }
const rowTitleStyle: CSSProperties = { display: "block", color: "#f8fafc", fontSize: 14, lineHeight: 1.35 }
const rowDetailStyle: CSSProperties = { display: "block", color: "#8da0b8", marginTop: 4, lineHeight: 1.4 }
const listStyle: CSSProperties = { display: "grid", gap: 10, padding: 12 }
const duplicateGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, padding: 12 }
const itemStyle: CSSProperties = { padding: 12, border: "1px solid rgba(148, 163, 184, 0.14)", borderRadius: 8, background: "rgba(2, 8, 23, 0.42)" }
const metaRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", color: "#8da0b8", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }
const itemTitleStyle: CSSProperties = { margin: "7px 0 5px", color: "#f8fafc", fontSize: 15, lineHeight: 1.35 }
const descriptionStyle: CSSProperties = { margin: 0, color: "#a8b6c7", fontSize: 13, lineHeight: 1.5 }
const emptyStyle: CSSProperties = { padding: 18, color: "#64748b", textAlign: "center" }
const noticeStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid", borderRadius: 8, background: "rgba(2, 8, 23, 0.82)", color: "#e2e8f0", fontSize: 13 }
const noticeCloseStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.26)", background: "transparent", color: "#cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 11, fontWeight: 800 }
const primaryButtonStyle: CSSProperties = { border: "1px solid rgba(74, 240, 196, 0.55)", background: "rgba(74, 240, 196, 0.16)", color: "#dffff6", borderRadius: 6, padding: "9px 11px", cursor: "pointer", fontSize: 11, fontWeight: 900 }
const secondaryButtonStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.72)", color: "#d7e1ee", borderRadius: 6, padding: "9px 11px", cursor: "pointer", fontSize: 11, fontWeight: 900 }

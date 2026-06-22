/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"

export type AssignmentDeskJobStatus = "scheduled" | "queued" | "running" | "failed" | "completed" | string

export type AssignmentDeskJobRow = {
  id: string
  title: string
  type: "newsroom-cycle" | "ai-batch" | "rag-reindex" | "digest" | string
  status: AssignmentDeskJobStatus
  scheduledFor?: string | Date | null
  queuedAt?: string | Date | null
  priority?: "low" | "normal" | "high" | "urgent" | string | null
  owner?: string | null
  detail?: string | null
  estimatedItems?: number | null
}

export type AssignmentDeskAction = {
  id: string
  title: string
  detail?: string | null
  tone?: "good" | "warn" | "bad" | "neutral"
  count?: number | null
}

export type AssignmentDeskModuleProps = {
  jobs: AssignmentDeskJobRow[]
  suggestedActions: AssignmentDeskAction[]
  activeJobCount: number
  pendingJobCount: number
  onRunNewsroomCycle?: () => void | Promise<void>
  onRunAiBatch?: () => void | Promise<void>
  onRunRagReindex?: () => void | Promise<void>
  onGenerateDigest?: () => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  jobEndpoint?: string
  jobPayloads?: Partial<Record<DeskAction, Record<string, unknown>>>
}

type DeskAction = "newsroom-cycle" | "ai-batch" | "rag-reindex" | "digest"

type Notice = {
  tone: "good" | "warn" | "bad"
  text: string
} | null

export default function AssignmentDeskModule({
  jobs,
  suggestedActions,
  activeJobCount,
  pendingJobCount,
  onRunNewsroomCycle,
  onRunAiBatch,
  onRunRagReindex,
  onGenerateDigest,
  onRefresh,
  jobEndpoint = "/api/admin/ai/jobs",
  jobPayloads,
}: AssignmentDeskModuleProps) {
  const [prevJobs, setPrevJobs] = useState(jobs)
  const [rows, setRows] = useState(jobs)
  if (jobs !== prevJobs) {
    setPrevJobs(jobs)
    setRows(jobs)
  }
  const [working, setWorking] = useState<DeskAction | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const sortedJobs = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTime = jobTime(a)
        const bTime = jobTime(b)
        if (aTime !== bTime) return aTime - bTime
        return priorityRank(b.priority) - priorityRank(a.priority)
      }),
    [rows]
  )

  const scheduledCount = useMemo(() => rows.filter((job) => job.status === "scheduled").length, [rows])
  const queuedCount = useMemo(() => rows.filter((job) => job.status === "queued").length, [rows])

  async function runAction(action: DeskAction) {
    const callback = callbackForAction(action)

    setWorking(action)
    setNotice(null)
    try {
      if (callback) {
        await callback()
      } else {
        const res = await fetch(jobEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jobPayloads?.[action] ?? payloadForAction(action)),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `${labelForAction(action)} failed`)
      }

      setNotice({ tone: "good", text: `${labelForAction(action)} queued successfully.` })
      await onRefresh?.()
    } catch (error) {
      console.error("[assignment desk]", action, error)
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : `${labelForAction(action)} failed.` })
    } finally {
      setWorking(null)
    }
  }

  function callbackForAction(action: DeskAction) {
    if (action === "newsroom-cycle") return onRunNewsroomCycle
    if (action === "ai-batch") return onRunAiBatch
    if (action === "rag-reindex") return onRunRagReindex
    return onGenerateDigest
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
        <MetricCard label="Active Jobs" value={formatNumber(activeJobCount)} detail="running or claimed" tone={activeJobCount > 0 ? "good" : "neutral"} />
        <MetricCard label="Pending Jobs" value={formatNumber(pendingJobCount)} detail="waiting for workers" tone={pendingJobCount > 10 ? "warn" : "neutral"} />
        <MetricCard label="Scheduled" value={formatNumber(scheduledCount)} detail="future newsroom work" />
        <MetricCard label="Queued" value={formatNumber(queuedCount)} detail="ready for dispatch" tone={queuedCount > 0 ? "warn" : "good"} />
      </div>

      <div style={actionRailStyle}>
        <div>
          <div style={panelTitleStyle}>ASSIGNMENT DESK</div>
          <p style={railCopyStyle}>Queue control for newsroom cycles, AI batches, RAG indexing, and digest production.</p>
        </div>
        <div style={buttonRailStyle}>
          <ActionButton label="NEWSROOM CYCLE" loading={working === "newsroom-cycle"} disabled={working !== null} onClick={() => runAction("newsroom-cycle")} />
          <ActionButton label="AI BATCH" loading={working === "ai-batch"} disabled={working !== null} onClick={() => runAction("ai-batch")} variant="secondary" />
          <ActionButton label="RAG REINDEX" loading={working === "rag-reindex"} disabled={working !== null} onClick={() => runAction("rag-reindex")} variant="secondary" />
          <ActionButton label="GENERATE DIGEST" loading={working === "digest"} disabled={working !== null} onClick={() => runAction("digest")} variant="secondary" />
        </div>
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>SCHEDULED / QUEUED JOBS</span>
            <span>{sortedJobs.length}</span>
          </div>
          <div style={tableWrapStyle}>
            <div style={jobHeaderStyle}>
              <span>Job</span>
              <span>Type</span>
              <span>Status</span>
              <span>When</span>
              <span>Items</span>
            </div>
            {sortedJobs.map((job) => (
              <div key={job.id} style={jobRowStyle}>
                <span>
                  <strong style={jobTitleStyle}>{job.title}</strong>
                  <small style={jobDetailStyle}>{job.detail ?? job.owner ?? "No assignment note supplied."}</small>
                </span>
                <span>{labelize(job.type)}</span>
                <span style={{ color: statusColor(job.status) }}>{job.status.toUpperCase()}</span>
                <span>{formatDate(job.scheduledFor ?? job.queuedAt)}</span>
                <span>{typeof job.estimatedItems === "number" ? formatNumber(job.estimatedItems) : "N/A"}</span>
              </div>
            ))}
            {sortedJobs.length === 0 && <div style={emptyStyle}>No scheduled or queued job rows supplied.</div>}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>SUGGESTED NEWSROOM ACTIONS</span>
            <span>{suggestedActions.length}</span>
          </div>
          <div style={listStyle}>
            {suggestedActions.map((action) => (
              <article key={action.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: toneColor(action.tone ?? "neutral") }}>{(action.tone ?? "neutral").toUpperCase()}</span>
                  {typeof action.count === "number" && <span>{formatNumber(action.count)} affected</span>}
                </div>
                <h3 style={itemTitleStyle}>{action.title}</h3>
                <p style={descriptionStyle}>{action.detail ?? "Recommended by the newsroom orchestration layer."}</p>
              </article>
            ))}
            {suggestedActions.length === 0 && <div style={emptyStyle}>No suggested newsroom actions supplied.</div>}
          </div>
        </section>
      </div>
    </section>
  )
}

function payloadForAction(action: DeskAction) {
  if (action === "newsroom-cycle") {
    return { type: "newsroom_cycle", title: "Run newsroom cycle", params: {} }
  }
  if (action === "ai-batch") {
    return { type: "ai_batch", title: "Run full AI batch", params: { task: "all", limit: 30 } }
  }
  if (action === "rag-reindex") {
    return { type: "rag_reindex", title: "Reindex RAG", params: { mode: "missing", limit: 50 } }
  }
  return { type: "digest_generate", title: "Generate digest", params: { regen: true } }
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
  variant?: "primary" | "secondary"
}) {
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

function jobTime(job: AssignmentDeskJobRow) {
  const date = job.scheduledFor ?? job.queuedAt
  const value = date ? new Date(date).getTime() : Number.MAX_SAFE_INTEGER
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

function priorityRank(priority?: string | null) {
  if (priority === "urgent") return 4
  if (priority === "high") return 3
  if (priority === "normal") return 2
  if (priority === "low") return 1
  return 0
}

function labelForAction(action: DeskAction) {
  if (action === "newsroom-cycle") return "Newsroom cycle"
  if (action === "ai-batch") return "AI batch"
  if (action === "rag-reindex") return "RAG reindex"
  return "Digest generation"
}

function statusColor(status: string) {
  if (status === "completed") return "#4af0c4"
  if (status === "running" || status === "queued") return "#f5c542"
  if (status === "failed") return "#ff6b6b"
  return "#9fb0c5"
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

function labelize(value: string) {
  return value.replace(/[-_]/g, " ").toUpperCase()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
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
const mainGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)", gap: 16 }
const panelStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.18)", background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, overflow: "hidden" }
const panelHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderBottom: "1px solid rgba(148, 163, 184, 0.16)", color: "#e2e8f0", fontSize: 12, fontWeight: 800, letterSpacing: 0 }
const tableWrapStyle: CSSProperties = { display: "grid", overflowX: "auto" }
const jobHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(260px, 1.6fr) 140px 110px 140px 80px", gap: 12, minWidth: 780, padding: "10px 14px", color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }
const jobRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(260px, 1.6fr) 140px 110px 140px 80px", gap: 12, minWidth: 780, padding: "12px 14px", borderTop: "1px solid rgba(148, 163, 184, 0.12)", color: "#cbd5e1", alignItems: "center", fontSize: 13 }
const jobTitleStyle: CSSProperties = { display: "block", color: "#f8fafc", fontSize: 14, lineHeight: 1.35 }
const jobDetailStyle: CSSProperties = { display: "block", color: "#8da0b8", marginTop: 4, lineHeight: 1.4 }
const listStyle: CSSProperties = { display: "grid", gap: 10, padding: 12 }
const itemStyle: CSSProperties = { padding: 12, border: "1px solid rgba(148, 163, 184, 0.14)", borderRadius: 8, background: "rgba(2, 8, 23, 0.42)" }
const metaRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", color: "#8da0b8", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }
const itemTitleStyle: CSSProperties = { margin: "7px 0 5px", color: "#f8fafc", fontSize: 15, lineHeight: 1.35 }
const descriptionStyle: CSSProperties = { margin: 0, color: "#a8b6c7", fontSize: 13, lineHeight: 1.5 }
const emptyStyle: CSSProperties = { padding: 18, color: "#64748b", textAlign: "center" }
const noticeStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid", borderRadius: 8, background: "rgba(2, 8, 23, 0.82)", color: "#e2e8f0", fontSize: 13 }
const noticeCloseStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.26)", background: "transparent", color: "#cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 11, fontWeight: 800 }
const primaryButtonStyle: CSSProperties = { border: "1px solid rgba(74, 240, 196, 0.55)", background: "rgba(74, 240, 196, 0.16)", color: "#dffff6", borderRadius: 6, padding: "9px 11px", cursor: "pointer", fontSize: 11, fontWeight: 900 }
const secondaryButtonStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.72)", color: "#d7e1ee", borderRadius: 6, padding: "9px 11px", cursor: "pointer", fontSize: 11, fontWeight: 900 }

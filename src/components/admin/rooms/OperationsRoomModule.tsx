"use client"

import type { CSSProperties } from "react"
import { useMemo, useState, useTransition } from "react"
import { cancelAllPendingJobs, retryAllFailedJobs, purgeOldJobs, runMigrations, queueReindexAll } from "@/app/admin/ai-manager/operations/actions"
import ConfirmButton from "@/components/admin/ConfirmButton"

export type OperationsRoomJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "dead_letter"
  | "cancelled"
  | string

export type OperationsRoomJob = {
  id: string
  type: string
  status: OperationsRoomJobStatus
  title: string
  error?: string | null
  phase?: string | null
  progress?: number | null
  retryCount?: number | null
  maxRetries?: number | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  completedAt?: string | Date | null
  scheduledFor?: string | Date | null
}

export type OperationsRoomJobGroups = {
  active: OperationsRoomJob[]
  failed: OperationsRoomJob[]
  recent: OperationsRoomJob[]
}

export type OperationsRoomModuleProps = {
  jobs: OperationsRoomJobGroups
  notifications: string[]
  systemHealth: string[]
}

type ActionState = {
  key: string
  message: string
  tone: "neutral" | "good" | "bad"
}

const activeStatuses = new Set(["queued", "running"])
const failedStatuses = new Set(["failed", "dead_letter"])
const recentStatuses = new Set(["cancelled", "completed"])

export default function OperationsRoomModule({
  jobs,
  notifications,
  systemHealth,
}: OperationsRoomModuleProps) {
  const [groups, setGroups] = useState(jobs)
  const [action, setAction] = useState<ActionState | null>(null)
  const [isPending, startTransition] = useTransition()

  const totals = useMemo(
    () => ({
      active: groups.active.length,
      failed: groups.failed.length,
      recent: groups.recent.length,
      retryable: groups.failed.filter(canRetry).length,
    }),
    [groups]
  )
  const actionBusy = action?.message === "Working..."

  async function refreshJobs() {
    const res = await fetch("/api/admin/ai/jobs")
    if (!res.ok) return

    const data = await res.json()
    if (Array.isArray(data.jobs)) {
      setGroups(groupJobs(data.jobs as OperationsRoomJob[]))
    }
  }

  async function postJobAction(key: string, url: string, successMessage: string) {
    setAction({ key, message: "Working...", tone: "neutral" })

    try {
      const res = await fetch(url, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          typeof data.error === "string" ? data.error : "The request failed."
        throw new Error(message)
      }

      await refreshJobs()
      setAction({ key, message: successMessage, tone: "good" })
    } catch (error) {
      setAction({
        key,
        message: error instanceof Error ? error.message : "The request failed.",
        tone: "bad",
      })
    }
  }

  return (
    <section style={moduleStyle} aria-label="Operations Room reliability tools">
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>OPERATIONS ROOM</div>
          <h2 style={titleStyle}>Reliability console</h2>
          <p style={copyStyle}>
            Queue recovery, retry triage, and recent job state in one compact
            view.
          </p>
        </div>
        <div style={headerActionsStyle}>
          <ConfirmButton
            onClick={() => {
              startTransition(async () => {
                try {
                  await cancelAllPendingJobs()
                  setAction({ key: "cancel-all", message: "All pending jobs cancelled.", tone: "good" })
                } catch (e) {
                  setAction({ key: "cancel-all", message: "Failed to cancel jobs.", tone: "bad" })
                }
              })
            }}
            disabled={actionBusy || isPending}
            style={buttonStateStyle(ghostButtonStyle, actionBusy || isPending)}
            confirmText="CONFIRM CANCEL"
          >
            {isPending && action?.key === "cancel-all" ? "CANCELLING..." : "CANCEL PENDING"}
          </ConfirmButton>
          <button
            type="button"
            onClick={() => {
              startTransition(async () => {
                try {
                  await retryAllFailedJobs()
                  setAction({ key: "retry-all", message: "All failed jobs queued for retry.", tone: "good" })
                } catch (e) {
                  setAction({ key: "retry-all", message: "Failed to retry jobs.", tone: "bad" })
                }
              })
            }}
            disabled={actionBusy || isPending || totals.failed === 0}
            style={buttonStateStyle(primaryButtonStyle, actionBusy || isPending)}
          >
            {isPending && action?.key === "retry-all" ? "QUEUING..." : "RETRY FAILED"}
          </button>
          <ConfirmButton
            onClick={() => {
              startTransition(async () => {
                try {
                  await purgeOldJobs()
                  setAction({ key: "purge-old", message: "Old jobs purged.", tone: "good" })
                } catch (e) {
                  setAction({ key: "purge-old", message: "Failed to purge jobs.", tone: "bad" })
                }
              })
            }}
            disabled={actionBusy || isPending}
            style={buttonStateStyle(ghostButtonStyle, actionBusy || isPending)}
            confirmText="CONFIRM PURGE"
          >
            {isPending && action?.key === "purge-old" ? "PURGING..." : "PURGE > 7 DAYS"}
          </ConfirmButton>
          <button
            type="button"
            onClick={() => {
              startTransition(async () => {
                try {
                  await runMigrations()
                  setAction({ key: "run-migrations", message: "Migrations queued.", tone: "good" })
                } catch (e) {
                  setAction({ key: "run-migrations", message: "Failed to queue migrations.", tone: "bad" })
                }
              })
            }}
            disabled={actionBusy || isPending}
            style={buttonStateStyle(ghostButtonStyle, actionBusy || isPending)}
          >
            {isPending && action?.key === "run-migrations" ? "QUEUING..." : "RUN MIGRATIONS"}
          </button>
          <ConfirmButton
            onClick={() => {
              startTransition(async () => {
                try {
                  await queueReindexAll()
                  setAction({ key: "reindex-all", message: "Full reindex queued.", tone: "good" })
                } catch (e) {
                  setAction({ key: "reindex-all", message: "Failed to queue reindex.", tone: "bad" })
                }
              })
            }}
            disabled={actionBusy || isPending}
            style={buttonStateStyle(ghostButtonStyle, actionBusy || isPending)}
            confirmText="CONFIRM REINDEX"
          >
            {isPending && action?.key === "reindex-all" ? "QUEUING..." : "REINDEX ALL"}
          </ConfirmButton>
        </div>
      </header>

      <div style={metricGridStyle}>
        <Metric label="ACTIVE" value={totals.active} tone="neutral" />
        <Metric label="FAILED / DEAD" value={totals.failed} tone="bad" />
        <Metric label="RETRYABLE" value={totals.retryable} tone="warn" />
        <Metric label="RECENT" value={totals.recent} tone="good" />
      </div>

      {action && (
        <div style={{ ...noticeStyle, color: toneColor(action.tone) }}>
          {action.message}
        </div>
      )}

      <div style={sideGridStyle}>
        <InfoPanel title="SYSTEM HEALTH" items={systemHealth} />
        <InfoPanel title="NOTIFICATIONS" items={notifications} />
      </div>

      <div style={tablesStyle}>
        <JobTable
          title="ACTIVE JOBS"
          jobs={groups.active}
          emptyText="No active jobs."
          renderActions={(job) => (
            <button
              type="button"
              onClick={() =>
                postJobAction(
                  `cancel:${job.id}`,
                  `/api/admin/ai/jobs/${job.id}/cancel`,
                  "Job cancelled."
                )
              }
              disabled={isWorking(`cancel:${job.id}`, action)}
              style={buttonStateStyle(smallButtonStyle, actionBusy, isWorking(`cancel:${job.id}`, action))}
            >
              {isWorking(`cancel:${job.id}`, action) ? "..." : "CANCEL"}
            </button>
          )}
        />

        <JobTable
          title="FAILED / DEAD LETTER"
          jobs={groups.failed}
          emptyText="No failed or dead-letter jobs."
          renderActions={(job) => (
            <div style={rowActionsStyle}>
              <button
                type="button"
                onClick={() =>
                  postJobAction(
                    `retry:${job.id}`,
                    `/api/admin/ai/jobs/${job.id}/retry`,
                    "Job queued for retry."
                  )
                }
                disabled={isWorking(`retry:${job.id}`, action)}
                style={buttonStateStyle(smallButtonStyle, actionBusy, isWorking(`retry:${job.id}`, action))}
              >
                {isWorking(`retry:${job.id}`, action) ? "..." : "RETRY"}
              </button>
              <button
                type="button"
                onClick={() =>
                  postJobAction(
                    `cancel:${job.id}`,
                    `/api/admin/ai/jobs/${job.id}/cancel`,
                    "Job cancelled."
                  )
                }
                disabled={isWorking(`cancel:${job.id}`, action)}
                style={buttonStateStyle(smallButtonStyle, actionBusy, isWorking(`cancel:${job.id}`, action))}
              >
                {isWorking(`cancel:${job.id}`, action) ? "..." : "CANCEL"}
              </button>
            </div>
          )}
        />

        <JobTable
          title="CANCELLED / RECENT"
          jobs={groups.recent}
          emptyText="No cancelled or recent jobs."
          renderActions={(job) =>
            job.status === "cancelled" || job.status === "failed" ? (
              <button
                type="button"
                onClick={() =>
                  postJobAction(
                    `retry:${job.id}`,
                    `/api/admin/ai/jobs/${job.id}/retry`,
                    "Job queued for retry."
                  )
                }
                disabled={isWorking(`retry:${job.id}`, action)}
                style={buttonStateStyle(smallButtonStyle, actionBusy, isWorking(`retry:${job.id}`, action))}
              >
                {isWorking(`retry:${job.id}`, action) ? "..." : "RETRY"}
              </button>
            ) : (
              <span style={mutedCellStyle}>-</span>
            )
          }
        />
      </div>
    </section>
  )
}

export function groupJobs(jobs: OperationsRoomJob[]): OperationsRoomJobGroups {
  return jobs.reduce<OperationsRoomJobGroups>(
    (next, job) => {
      if (activeStatuses.has(job.status)) next.active.push(job)
      else if (failedStatuses.has(job.status)) next.failed.push(job)
      else if (recentStatuses.has(job.status)) next.recent.push(job)
      return next
    },
    { active: [], failed: [], recent: [] }
  )
}

function JobTable({
  title,
  jobs,
  emptyText,
  renderActions,
}: {
  title: string
  jobs: OperationsRoomJob[]
  emptyText: string
  renderActions: (job: OperationsRoomJob) => React.ReactNode
}) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span>{title}</span>
        <span>{jobs.length}</span>
      </div>
      <div style={tableStyle}>
        <div style={tableHeadStyle}>
          <span>JOB</span>
          <span>STATUS</span>
          <span>RETRY</span>
          <span>UPDATED</span>
          <span>ACTION</span>
        </div>
        {jobs.map((job) => (
          <div key={job.id} style={tableRowStyle}>
            <div style={jobCellStyle}>
              <strong>{job.title}</strong>
              <small>
                {job.type}
                {job.phase ? ` / ${job.phase}` : ""}
              </small>
              {job.error && <small style={errorStyle}>{job.error}</small>}
            </div>
            <span style={{ color: statusColor(job.status) }}>
              {job.status.toUpperCase()}
            </span>
            <span>{retryLabel(job)}</span>
            <span>{formatDate(job.updatedAt ?? job.completedAt ?? job.createdAt)}</span>
            <span>{renderActions(job)}</span>
          </div>
        ))}
        {jobs.length === 0 && <div style={emptyStyle}>{emptyText}</div>}
      </div>
    </section>
  )
}

function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span>{title}</span>
        <span>{items.length}</span>
      </div>
      <div style={infoListStyle}>
        {items.slice(0, 8).map((item) => (
          <div key={item} style={infoItemStyle}>
            {item}
          </div>
        ))}
        {items.length === 0 && <div style={emptyStyle}>No signals.</div>}
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: ActionState["tone"] | "warn"
}) {
  return (
    <div style={metricStyle}>
      <span>{label}</span>
      <strong style={{ color: toneColor(tone) }}>{value}</strong>
    </div>
  )
}

function canRetry(job: OperationsRoomJob) {
  if (!failedStatuses.has(job.status)) return false
  if (typeof job.retryCount !== "number" || typeof job.maxRetries !== "number") {
    return true
  }
  return job.retryCount < job.maxRetries || job.status === "dead_letter"
}

function retryLabel(job: OperationsRoomJob) {
  const retryCount = typeof job.retryCount === "number" ? job.retryCount : 0
  return typeof job.maxRetries === "number"
    ? `${retryCount}/${job.maxRetries}`
    : String(retryCount)
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function isWorking(key: string, action: ActionState | null) {
  return action?.key === key && action.message === "Working..."
}

function statusColor(status: string) {
  if (status === "completed") return "#4af0c4"
  if (status === "failed" || status === "dead_letter") return "#ff6b6b"
  if (status === "cancelled") return "#f5c542"
  if (status === "running") return "var(--accent)"
  return "var(--muted)"
}

function toneColor(tone: ActionState["tone"] | "warn") {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  if (tone === "bad") return "#ff6b6b"
  return "var(--accent)"
}

function buttonStateStyle(base: CSSProperties, disabled: boolean, active = false): CSSProperties {
  return {
    ...base,
    opacity: disabled && !active ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  }
}

const moduleStyle: CSSProperties = {
  display: "grid",
  gap: 16,
}

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  padding: 18,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
}

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
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
  letterSpacing: 0,
}

const copyStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  maxWidth: 620,
}

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
}

const metricStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 13,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const noticeStyle: CSSProperties = {
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const sideGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
}

const tablesStyle: CSSProperties = {
  display: "grid",
  gap: 12,
}

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 14,
  minWidth: 0,
}

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
  marginBottom: 10,
}

const tableStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  overflowX: "auto",
}

const tableHeadStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.6fr) 110px 80px 150px 120px",
  gap: 10,
  minWidth: 740,
  padding: "0 8px 4px",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const tableRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1.6fr) 110px 80px 150px 120px",
  alignItems: "center",
  gap: 10,
  minWidth: 740,
  padding: 9,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const jobCellStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
}

const errorStyle: CSSProperties = {
  color: "#ff9a9a",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const rowActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
}

const primaryButtonStyle: CSSProperties = {
  padding: "8px 10px",
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  cursor: "pointer",
}

const ghostButtonStyle: CSSProperties = {
  padding: "8px 10px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  cursor: "pointer",
}

const smallButtonStyle: CSSProperties = {
  padding: "5px 8px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
}

const infoListStyle: CSSProperties = {
  display: "grid",
  gap: 7,
}

const infoItemStyle: CSSProperties = {
  padding: 9,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  lineHeight: 1.5,
}

const mutedCellStyle: CSSProperties = {
  color: "var(--muted)",
}

const emptyStyle: CSSProperties = {
  padding: 16,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "center",
}

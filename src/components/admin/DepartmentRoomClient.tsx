"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import { useState } from "react"

type ActionCard = {
  jobType: "newsroom_cycle" | "rag_reindex" | "ai_batch" | "digest_generate"
  label: string
  params: Record<string, unknown>
  confirmLabel: string
}

type Department = {
  id: string
  label: string
  route: string
  agent: string
  description: string
  staff?: readonly {
    name: string
    role: string
    focus: string
  }[]
}

type RoomEvent = {
  id: string
  department: string
  type: string
  title: string
  body: string
  severity: string
  status: string
  needsEditorReview: boolean
  createdAt: string | Date
  job?: {
    id: string
    status: string
    title: string
    type: string
  } | null
}

type RoomJob = {
  id: string
  type: string
  status: string
  title: string
  progress?: number | null
  phase?: string | null
  retryCount?: number | null
  maxRetries?: number | null
  updatedAt: string | Date
}

type Metric = {
  label: string
  value: string | number
  tone?: "neutral" | "good" | "warn" | "bad"
}

type JobPreview = {
  title: string
  affectedCount: number
  affectedLabel: string
  estimate: string
  affectedTopics: string[]
  warnings: string[]
}

type Notice = {
  tone: "info" | "good" | "warn" | "bad"
  text: string
}

export default function DepartmentRoomClient({
  department,
  metrics,
  actions,
  initialEvents,
  jobs,
  notifications,
}: {
  department: Department
  metrics: Metric[]
  actions: ActionCard[]
  initialEvents: RoomEvent[]
  jobs: RoomJob[]
  notifications: RoomEvent[]
}) {
  const [events, setEvents] = useState(initialEvents)
  const [loading, setLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [preview, setPreview] = useState<{ card: ActionCard; data: JobPreview } | null>(null)
  const isBusy = loading !== null

  async function refreshEvents() {
    const res = await fetch(`/api/admin/ai/departments/${department.id}/events`)
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data.events)) setEvents(data.events)
  }

  async function previewJob(card: ActionCard) {
    const key = `preview:${card.label}`
    setLoading(key)
    setNotice(null)
    try {
      const res = await fetch("/api/admin/ai/jobs/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: card.jobType, params: card.params }),
      })
      if (!res.ok) throw new Error("Preview failed")
      const data = await res.json()
      if (data.preview) setPreview({ card, data: data.preview })
      else setNotice({ tone: "warn", text: "No preview payload was returned for this task." })
    } catch (error) {
      console.error("[department room] preview failed:", error)
      setNotice({ tone: "bad", text: "Could not preview this task. Check admin logs and try again." })
    } finally {
      setLoading(null)
    }
  }

  async function createJob(card: ActionCard) {
    const key = `job:${card.label}`
    setLoading(key)
    setNotice(null)
    try {
      const res = await fetch("/api/admin/ai/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: card.jobType,
          title: card.label,
          params: card.params,
        }),
      })
      if (!res.ok) throw new Error("Job failed")
      setPreview(null)
      setNotice({ tone: "good", text: "Task queued. Progress will appear in this room activity log." })
      await refreshEvents()
    } catch (error) {
      console.error("[department room] job failed:", error)
      setNotice({ tone: "bad", text: "Could not queue this task. Check admin logs and try again." })
    } finally {
      setLoading(null)
    }
  }

  async function mutateEvent(action: "read" | "resolve" | "escalate", id?: string) {
    setLoading(`${action}:${id ?? "all"}`)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/ai/departments/${department.id}/events/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error(`${action} failed`)
      await refreshEvents()
      setNotice({
        tone: action === "escalate" ? "warn" : "good",
        text:
          action === "read"
            ? "Room item marked read."
            : action === "resolve"
              ? "Room item resolved."
              : "Room item sent to the Main Editor inbox.",
      })
    } catch (error) {
      console.error(`[department room] ${action} failed:`, error)
      setNotice({ tone: "bad", text: `Could not ${action} this room item.` })
    } finally {
      setLoading(null)
    }
  }

  async function resumeQueue() {
    setLoading("resume")
    setNotice(null)
    try {
      const res = await fetch("/api/admin/ai/jobs/run-next", { method: "POST" })
      if (!res.ok) throw new Error("Resume failed")
      await refreshEvents()
      setNotice({ tone: "info", text: "Pipeline check completed. Review activity below for changes." })
    } catch (error) {
      console.error("[department room] resume failed:", error)
      setNotice({ tone: "bad", text: "Could not check the pipeline right now." })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div aria-busy={isBusy} style={shellStyle}>
      <div style={topBarStyle}>
        <Link href="/admin/ai-manager" style={backLinkStyle}>
          AI MANAGER
        </Link>
        <span>{department.agent}</span>
      </div>

      <header style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>DEPARTMENT ROOM</div>
          <h1 style={titleStyle}>{department.label}</h1>
          <p style={copyStyle}>{department.description}</p>
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={resumeQueue}
          style={buttonStateStyle(ghostButtonStyle, isBusy)}
        >
          {loading === "resume" ? "CHECKING..." : "CHECK / RESUME PIPELINE"}
        </button>
      </header>

      {notice && (
        <div style={{ ...noticeStyle, borderColor: noticeColor(notice.tone) }}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} style={noticeCloseStyle}>
            CLOSE
          </button>
        </div>
      )}

      {department.staff && department.staff.length > 0 && (
        <section style={staffGridStyle}>
          {department.staff.map((member) => (
            <article key={`${member.name}-${member.role}`} style={staffCardStyle}>
              <div style={staffMetaStyle}>{member.role}</div>
              <strong style={staffNameStyle}>{member.name}</strong>
              <p style={staffFocusStyle}>{member.focus}</p>
            </article>
          ))}
        </section>
      )}

      <section style={metricGridStyle}>
        {metrics.map((metric) => (
          <div key={metric.label} style={metricCardStyle}>
            <span>{metric.label}</span>
            <strong style={{ color: toneColor(metric.tone) }}>{metric.value}</strong>
          </div>
        ))}
      </section>

      <section style={mainGridStyle}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>ROOM ACTIONS</span>
            <button
              type="button"
              disabled={isBusy || events.length === 0}
              onClick={() => mutateEvent("read")}
              style={buttonStateStyle(smallButtonStyle, isBusy || events.length === 0)}
            >
              {loading === "read:all" ? "MARKING..." : "MARK ROOM READ"}
            </button>
          </div>
          <div style={actionGridStyle}>
            {actions.map((card) => (
              <button
                key={card.label}
                type="button"
                disabled={isBusy}
                onClick={() => previewJob(card)}
                style={buttonStateStyle(actionButtonStyle, isBusy, loading === `preview:${card.label}`)}
              >
                <span>{card.label}</span>
                <small>{loading === `preview:${card.label}` ? "PREVIEWING..." : card.confirmLabel}</small>
              </button>
            ))}
          </div>
          {preview && (
            <div style={previewStyle}>
              <div style={previewTitleStyle}>{preview.data.title}</div>
              <p style={previewCopyStyle}>
                This will process {preview.data.affectedCount} {preview.data.affectedLabel}.
                Runtime: {preview.data.estimate}.
              </p>
              {preview.data.warnings.map((warning) => (
                <div key={warning} style={warningStyle}>{warning}</div>
              ))}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => createJob(preview.card)}
                style={buttonStateStyle(runButtonStyle, isBusy, loading === `job:${preview.card.label}`)}
              >
                {loading === `job:${preview.card.label}` ? "QUEUING..." : "RUN CONFIRMED JOB"}
              </button>
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>ROOM NOTIFICATIONS</span>
            <span>{notifications.length}</span>
          </div>
          <div style={compactListStyle}>
            {notifications.slice(0, 6).map((item) => (
              <div key={item.id} style={compactItemStyle}>
                <span>{item.title}</span>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
            ))}
            {notifications.length === 0 && <div style={emptyStyle}>No room notifications.</div>}
          </div>
        </div>
      </section>

      <section style={mainGridStyle}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>PIPELINE / ACTIVITY LOG</span>
            <span>{events.length}</span>
          </div>
          <div style={eventListStyle}>
            {isBusy && (
              <div style={skeletonStackStyle} aria-hidden="true">
                <div style={skeletonLineStyle} />
                <div style={{ ...skeletonLineStyle, width: "72%" }} />
              </div>
            )}
            {events.map((event) => (
              <article key={event.id} style={eventItemStyle}>
                <div style={eventMetaStyle}>
                  <span style={{ color: toneColor(severityTone(event.severity)) }}>
                    {event.severity.toUpperCase()} / {event.type.toUpperCase()}
                  </span>
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <h3 style={eventTitleStyle}>{event.title}</h3>
                <p style={eventBodyStyle}>{event.body}</p>
                {event.job && (
                  <div style={jobMiniStyle}>
                    {event.job.title} · {event.job.status.toUpperCase()}
                  </div>
                )}
                <div style={eventActionsStyle}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => mutateEvent("read", event.id)}
                    style={buttonStateStyle(smallButtonStyle, isBusy, loading === `read:${event.id}`)}
                  >
                    {loading === `read:${event.id}` ? "..." : "READ"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => mutateEvent("resolve", event.id)}
                    style={buttonStateStyle(smallButtonStyle, isBusy, loading === `resolve:${event.id}`)}
                  >
                    {loading === `resolve:${event.id}` ? "..." : "RESOLVE"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => mutateEvent("escalate", event.id)}
                    style={buttonStateStyle(smallButtonStyle, isBusy, loading === `escalate:${event.id}`)}
                  >
                    {loading === `escalate:${event.id}` ? "SENDING..." : "SEND TO MAIN EDITOR"}
                  </button>
                </div>
              </article>
            ))}
            {events.length === 0 && <div style={emptyStyle}>No pipeline events yet.</div>}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>QUEUE / RECENT JOBS</span>
            <span>{jobs.length}</span>
          </div>
          <div style={jobListStyle}>
            {jobs.map((job) => (
              <div key={job.id} style={jobItemStyle}>
                <div>
                  <strong>{job.title}</strong>
                  <small>{job.type} · {job.phase ?? "no phase"}</small>
                </div>
                <span>{job.status.toUpperCase()}</span>
              </div>
            ))}
            {jobs.length === 0 && <div style={emptyStyle}>No jobs in this room yet.</div>}
          </div>
        </div>
      </section>
    </div>
  )
}

function severityTone(severity: string): Metric["tone"] {
  if (severity === "success") return "good"
  if (severity === "warning") return "warn"
  if (severity === "error") return "bad"
  return "neutral"
}

function toneColor(tone: Metric["tone"] = "neutral") {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  if (tone === "bad") return "#ff6b6b"
  return "var(--accent)"
}

function noticeColor(tone: Notice["tone"]) {
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

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 20,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
}

const backLinkStyle: CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none",
}

const heroStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  padding: 22,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  marginBottom: 18,
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
  fontSize: 30,
}

const copyStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.6,
  maxWidth: 640,
}

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: 10,
  marginBottom: 16,
  minWidth: 0,
}

const noticeStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1px solid",
  borderRadius: 6,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  lineHeight: 1.5,
}

const noticeCloseStyle: CSSProperties = {
  padding: "4px 7px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
}

const staffGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
  gap: 10,
  marginBottom: 16,
  minWidth: 0,
}

const staffCardStyle: CSSProperties = {
  minHeight: 106,
  padding: 13,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  display: "grid",
  alignContent: "start",
  gap: 7,
}

const staffMetaStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "1px",
  textTransform: "uppercase",
}

const staffNameStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
}

const staffFocusStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.5,
}

const metricCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 14,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
}

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
  gap: 16,
  marginBottom: 16,
  minWidth: 0,
}

const panelStyle: CSSProperties = {
  minWidth: 0,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 16,
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

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
  gap: 8,
  minWidth: 0,
}

const actionButtonStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 11,
  background: "rgba(108,143,255,0.08)",
  border: "1px solid rgba(108,143,255,0.24)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "left",
  cursor: "pointer",
}

const previewStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  background: "rgba(74,240,196,0.06)",
  border: "1px solid rgba(74,240,196,0.18)",
  borderRadius: 5,
}

const previewTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
}

const previewCopyStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.6,
}

const warningStyle: CSSProperties = {
  color: "#f5c542",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  marginBottom: 6,
}

const runButtonStyle: CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  cursor: "pointer",
}

const compactListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const compactItemStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 0,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const eventListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 620,
  overflowY: "auto",
  minWidth: 0,
}

const skeletonStackStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
}

const skeletonLineStyle: CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(108,143,255,0.18), rgba(255,255,255,0.06))",
}

const eventItemStyle: CSSProperties = {
  minWidth: 0,
  padding: 12,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
}

const eventMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const eventTitleStyle: CSSProperties = {
  margin: "8px 0 4px",
  color: "var(--text)",
  fontSize: 13,
  overflowWrap: "anywhere",
}

const eventBodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
}

const jobMiniStyle: CSSProperties = {
  marginTop: 8,
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  overflowWrap: "anywhere",
}

const eventActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
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

const jobListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
}

const jobItemStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 12,
  minWidth: 0,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
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

const emptyStyle: CSSProperties = {
  padding: 18,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "center",
}

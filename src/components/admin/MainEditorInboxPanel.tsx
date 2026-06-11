"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import { useMemo, useState } from "react"

export type MainEditorInboxEvent = {
  id: string
  department: string
  type: string
  title: string
  body: string
  severity: string
  status: string
  needsEditorReview: boolean
  jobId?: string | null
  sourceType?: string | null
  metadata?: unknown
  createdAt: string
  job?: {
    id: string
    type: string
    status: string
    title: string
    createdAt?: string | Date
    updatedAt?: string | Date
  } | null
}

const DEPARTMENT_LABELS: Record<string, string> = {
  assignment: "Assignment Desk",
  reporting: "Reporting Room",
  verification: "Verification Room",
  copy_desk: "Copy Desk",
  research: "Research Library",
  digest: "Digest Room",
  publishing: "Publishing Desk",
  operations: "Operations Room",
}

function departmentHref(department: string) {
  return `/admin/ai-manager/${department === "copy_desk" ? "copy-desk" : department}`
}

function severityRank(severity: string) {
  if (severity === "error") return 0
  if (severity === "warning") return 1
  if (severity === "success") return 3
  return 2
}

export default function MainEditorInboxPanel({
  events,
  onAskEditor,
  onResolved,
}: {
  events: MainEditorInboxEvent[]
  onAskEditor: (prompt: string, context?: Record<string, unknown>) => Promise<void> | void
  onResolved?: () => Promise<void> | void
}) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [askingId, setAskingId] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "review" | "unread">("review")
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.id ?? null)
  const departments = useMemo(
    () => Array.from(new Set(events.map((event) => event.department))).sort(),
    [events]
  )
  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const departmentMatch =
          departmentFilter === "all" || event.department === departmentFilter
        const statusMatch =
          statusFilter === "all" ||
          (statusFilter === "review" && event.needsEditorReview) ||
          (statusFilter === "unread" && event.status === "unread")
        return departmentMatch && statusMatch
      }),
    [departmentFilter, events, statusFilter]
  )
  const selectedEvent = useMemo(
    () =>
      filteredEvents.find((event) => event.id === selectedId) ??
      filteredEvents[0] ??
      null,
    [filteredEvents, selectedId]
  )
  const grouped = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => {
      const severityDelta = severityRank(a.severity) - severityRank(b.severity)
      if (severityDelta !== 0) return severityDelta
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return sorted.reduce<Record<string, MainEditorInboxEvent[]>>((acc, event) => {
      acc[event.department] = acc[event.department] ?? []
      acc[event.department].push(event)
      return acc
    }, {})
  }, [filteredEvents])

  async function resolveEvent(event: MainEditorInboxEvent) {
    setResolvingId(event.id)
    setActionNotice(null)
    try {
      const res = await fetch(`/api/admin/ai/departments/${event.department}/events/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id }),
      })
      if (!res.ok) throw new Error("Resolve request failed")
      await onResolved?.()
    } catch (error) {
      console.error("[main editor inbox] resolve failed:", error)
      setActionNotice("Could not resolve that event. Check admin logs and try again.")
    } finally {
      setResolvingId(null)
    }
  }

  async function askEditor(event: MainEditorInboxEvent) {
    if (askingId) return
    setAskingId(event.id)
    setActionNotice(null)
    try {
      await onAskEditor(
        "Review the selected Main Editor escalation and recommend the next action.",
        buildEditorContext(event)
      )
    } catch (error) {
      console.error("[main editor inbox] ask editor failed:", error)
      setActionNotice("Could not send that escalation to the editor chat.")
    } finally {
      setAskingId(null)
    }
  }

  if (events.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>MAIN EDITOR INBOX</span>
          <span>0</span>
        </div>
        <div style={emptyStyle}>No escalations for Main Editor.</div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>MAIN EDITOR INBOX</span>
        <span>{events.length}</span>
      </div>

      {actionNotice && <div style={noticeStyle}>{actionNotice}</div>}

      <div style={filterBarStyle}>
        <select
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          style={selectStyle}
          aria-label="Filter Main Editor inbox by department"
        >
          <option value="all">All departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {DEPARTMENT_LABELS[department] ?? department}
            </option>
          ))}
        </select>
        {(["review", "unread", "all"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            style={{
              ...filterButtonStyle,
              color: statusFilter === filter ? "var(--accent)" : "var(--muted)",
              borderColor: statusFilter === filter ? "var(--accent)" : "var(--border2)",
            }}
          >
            {filter === "review" ? "Needs review" : filter}
          </button>
        ))}
      </div>

      <div style={contentGridStyle}>
        <div style={listStyle}>
          {Object.entries(grouped).map(([department, departmentEvents]) => (
            <section key={department} style={groupStyle}>
              <div style={groupHeaderStyle}>
                <Link href={departmentHref(department)} style={departmentLinkStyle}>
                  {DEPARTMENT_LABELS[department] ?? department}
                </Link>
                <span>{departmentEvents.length}</span>
              </div>

              {departmentEvents.slice(0, 6).map((event) => (
                <article
                  key={event.id}
                  style={{
                    ...itemStyle,
                    borderColor:
                      selectedEvent?.id === event.id ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    style={eventSelectStyle}
                  >
                    <div style={metaStyle}>
                      <span style={{ color: severityColor(event.severity) }}>
                        {event.severity.toUpperCase()} / {event.status.toUpperCase()}
                      </span>
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={titleStyle}>{event.title}</div>
                    <p style={bodyStyle}>{event.body}</p>
                    <div style={metadataPreviewStyle}>
                      <span>event {shortId(event.id)}</span>
                      {event.jobId && <span>job {shortId(event.jobId)}</span>}
                      {articleIdFromMetadata(event.metadata) && (
                        <span>article {shortId(articleIdFromMetadata(event.metadata) ?? "")}</span>
                      )}
                    </div>
                  </button>
                  <div style={actionsStyle}>
                    <button
                      type="button"
                      style={actionButtonStyle(Boolean(askingId))}
                      disabled={Boolean(askingId)}
                      onClick={() => askEditor(event)}
                    >
                      {askingId === event.id ? "ASKING..." : "ASK EDITOR"}
                    </button>
                    <button
                      type="button"
                      style={actionButtonStyle(resolvingId === event.id)}
                      disabled={resolvingId === event.id}
                      onClick={() => resolveEvent(event)}
                    >
                      {resolvingId === event.id ? "RESOLVING..." : "RESOLVE"}
                    </button>
                    <Link href={eventHref(event)} style={roomLinkStyle}>
                      OPEN
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          ))}
          {filteredEvents.length === 0 && (
            <div style={emptyStyle}>No escalations match this filter.</div>
          )}
        </div>

        <aside style={detailStyle}>
          {selectedEvent ? (
            <>
              <div style={detailHeaderStyle}>
                <span>SELECTED PIPELINE EVENT</span>
                <span style={{ color: severityColor(selectedEvent.severity) }}>
                  {selectedEvent.severity.toUpperCase()}
                </span>
              </div>
              <h3 style={detailTitleStyle}>{selectedEvent.title}</h3>
              <p style={bodyStyle}>{selectedEvent.body}</p>
              <div style={contextGridStyle}>
                <ContextRow label="Department" value={DEPARTMENT_LABELS[selectedEvent.department] ?? selectedEvent.department} />
                <ContextRow label="Event ID" value={selectedEvent.id} />
                <ContextRow label="Type" value={selectedEvent.type} />
                <ContextRow label="Status" value={selectedEvent.status} />
                <ContextRow label="Review" value={selectedEvent.needsEditorReview ? "Needs Main Editor" : "Normal"} />
                <ContextRow label="Source" value={selectedEvent.sourceType ?? "unknown"} />
                <ContextRow label="Job ID" value={selectedEvent.jobId ?? selectedEvent.job?.id ?? "none"} />
                <ContextRow label="Article ID" value={articleIdFromMetadata(selectedEvent.metadata) ?? "none"} />
                {selectedEvent.job && (
                  <>
                    <ContextRow label="Job Title" value={selectedEvent.job.title} />
                    <ContextRow label="Job Type" value={selectedEvent.job.type} />
                    <ContextRow label="Job Status" value={selectedEvent.job.status} />
                  </>
                )}
              </div>
              <MetadataBlock metadata={selectedEvent.metadata} />
              <div style={actionsStyle}>
                <button
                  type="button"
                  style={actionButtonStyle(Boolean(askingId))}
                  disabled={Boolean(askingId)}
                  onClick={() => askEditor(selectedEvent)}
                >
                  {askingId === selectedEvent.id ? "ASKING..." : "ASK WITH CONTEXT"}
                </button>
                <button
                  type="button"
                  style={actionButtonStyle(resolvingId === selectedEvent.id)}
                  disabled={resolvingId === selectedEvent.id}
                  onClick={() => resolveEvent(selectedEvent)}
                >
                  {resolvingId === selectedEvent.id ? "RESOLVING..." : "RESOLVE EVENT"}
                </button>
                <Link href={eventHref(selectedEvent)} style={roomLinkStyle}>
                  OPEN DEPARTMENT
                </Link>
              </div>
            </>
          ) : (
            <div style={emptyStyle}>Select an escalation to inspect metadata.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={contextRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MetadataBlock({ metadata }: { metadata: unknown }) {
  const entries = metadataEntries(metadata)
  if (entries.length === 0) {
    return <div style={metadataEmptyStyle}>No extra metadata attached.</div>
  }

  return (
    <div style={metadataBlockStyle}>
      <span>Metadata</span>
      {entries.map(([key, value]) => (
        <div key={key} style={metadataRowStyle}>
          <span>{key}</span>
          <code>{value}</code>
        </div>
      ))}
    </div>
  )
}

function buildEditorContext(event: MainEditorInboxEvent) {
  return {
    department: DEPARTMENT_LABELS[event.department] ?? event.department,
    departmentId: event.department,
    eventId: event.id,
    eventType: event.type,
    severity: event.severity,
    status: event.status,
    needsEditorReview: event.needsEditorReview,
    jobId: event.jobId ?? event.job?.id ?? null,
    job: event.job
      ? {
          id: event.job.id,
          type: event.job.type,
          status: event.job.status,
          title: event.job.title,
        }
      : null,
    articleId: articleIdFromMetadata(event.metadata),
    sourceType: event.sourceType ?? null,
    metadata: normalizeMetadata(event.metadata),
    title: event.title,
    body: event.body,
  }
}

function eventHref(event: MainEditorInboxEvent) {
  const params = new URLSearchParams({ event: event.id })
  if (event.jobId ?? event.job?.id) params.set("job", event.jobId ?? event.job?.id ?? "")
  const articleId = articleIdFromMetadata(event.metadata)
  if (articleId) params.set("article", articleId)
  return `${departmentHref(event.department)}?${params.toString()}`
}

function shortId(value: string) {
  return value.length > 10 ? value.slice(0, 8) : value
}

function normalizeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  return metadata as Record<string, unknown>
}

function metadataEntries(metadata: unknown) {
  const record = normalizeMetadata(metadata)
  if (!record) return []
  return Object.entries(record)
    .slice(0, 8)
    .map(([key, value]) => [
      key,
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value),
    ] as const)
}

function articleIdFromMetadata(metadata: unknown) {
  const record = normalizeMetadata(metadata)
  if (!record) return null
  const value = record.articleId ?? record.article_id ?? record.draftId ?? record.draft_id
  return typeof value === "string" ? value : null
}

function severityColor(severity: string) {
  if (severity === "error") return "#ff6b6b"
  if (severity === "warning") return "#f5c542"
  if (severity === "success") return "#4af0c4"
  return "var(--accent)"
}

function actionButtonStyle(disabled: boolean): CSSProperties {
  return {
    ...buttonStyle,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  }
}

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  overflow: "hidden",
}

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderBottom: "1px solid var(--border)",
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const noticeStyle: CSSProperties = {
  padding: "8px 14px",
  borderBottom: "1px solid var(--border)",
  background: "rgba(255,107,107,0.08)",
  color: "#ff6b6b",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const listStyle: CSSProperties = {
  display: "grid",
  maxHeight: 520,
  overflowY: "auto",
}

const filterBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  padding: "10px 14px",
  borderBottom: "1px solid var(--border)",
}

const selectStyle: CSSProperties = {
  minHeight: 30,
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "5px 8px",
}

const filterButtonStyle: CSSProperties = {
  padding: "5px 8px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
  cursor: "pointer",
}

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 0.9fr) minmax(260px, 1.1fr)",
  gap: 0,
}

const groupStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
}

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.8px",
}

const departmentLinkStyle: CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none",
}

const itemStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
}

const eventSelectStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  width: "100%",
  padding: 0,
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
}

const metaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const titleStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.5,
}

const metadataPreviewStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
}

const buttonStyle: CSSProperties = {
  padding: "5px 8px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
}

const roomLinkStyle: CSSProperties = {
  ...buttonStyle,
  textDecoration: "none",
  display: "inline-flex",
}

const detailStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 10,
  padding: 14,
  borderLeft: "1px solid var(--border)",
  background: "rgba(255,255,255,0.018)",
  minWidth: 0,
}

const detailHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.9px",
}

const detailTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  lineHeight: 1.45,
}

const contextGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 6,
}

const contextRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "88px minmax(0, 1fr)",
  gap: 8,
  padding: "6px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  wordBreak: "break-word",
}

const metadataBlockStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const metadataRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px minmax(0, 1fr)",
  gap: 8,
  alignItems: "start",
}

const metadataEmptyStyle: CSSProperties = {
  padding: 10,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  border: "1px solid var(--border)",
  borderRadius: 5,
}

const emptyStyle: CSSProperties = {
  padding: 20,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "center",
}

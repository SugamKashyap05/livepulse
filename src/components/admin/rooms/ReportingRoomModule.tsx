"use client"

import type { CSSProperties } from "react"
import { useMemo, useState } from "react"

export type ReportingScoutStatus = {
  status: "idle" | "running" | "degraded" | "failed" | string
  activeAgents: number
  pendingSources: number
  lastRunAt?: string | Date | null
  model?: string | null
  note?: string | null
}

export type ReportingDraftRow = {
  id: string
  title: string
  topic?: string | null
  sourceName?: string | null
  status?: "draft" | "ready" | "needs-review" | "failed" | string
  createdAt?: string | Date | null
  confidence?: number | null
  summary?: string | null
}

export type ReportingStoryCandidate = {
  id: string
  title: string
  topic: string
  sourceName?: string | null
  sourceUrl?: string | null
  score?: number | null
  reason?: string | null
  discoveredAt?: string | Date | null
}

export type ReportingCoverageGap = {
  id: string
  topic: string
  severity: "low" | "medium" | "high" | "critical" | string
  missingSources?: number | null
  detail?: string | null
  lastCoveredAt?: string | Date | null
}

export type ReportingScoutActivity = {
  id: string
  title: string
  detail?: string | null
  status: "success" | "warning" | "failure" | "running" | string
  createdAt?: string | Date | null
}

export type ReportingRoomModuleProps = {
  scoutStatus: ReportingScoutStatus
  generatedDrafts: ReportingDraftRow[]
  storyCandidates: ReportingStoryCandidate[]
  coverageGaps: ReportingCoverageGap[]
  recentActivity: ReportingScoutActivity[]
  onRunScout?: () => void | Promise<void>
  onGenerateDrafts?: () => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  scoutEndpoint?: string
  draftEndpoint?: string
  scoutPayload?: Record<string, unknown>
  draftPayload?: Record<string, unknown>
}

type ReportingAction = "scout" | "drafts"

type Notice = {
  tone: "good" | "warn" | "bad"
  text: string
} | null

export default function ReportingRoomModule({
  scoutStatus,
  generatedDrafts,
  storyCandidates,
  coverageGaps,
  recentActivity,
  onRunScout,
  onGenerateDrafts,
  onRefresh,
  scoutEndpoint = "/api/admin/ai/jobs",
  draftEndpoint = "/api/admin/ai/jobs",
  scoutPayload,
  draftPayload,
}: ReportingRoomModuleProps) {
  const [working, setWorking] = useState<ReportingAction | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const sortedDrafts = useMemo(() => [...generatedDrafts].sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt)), [generatedDrafts])
  const sortedCandidates = useMemo(() => [...storyCandidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [storyCandidates])
  const highGaps = useMemo(() => coverageGaps.filter((gap) => gap.severity === "high" || gap.severity === "critical").length, [coverageGaps])

  async function runAction(action: ReportingAction) {
    setWorking(action)
    setNotice(null)
    try {
      if (action === "scout" && onRunScout) {
        await onRunScout()
      } else if (action === "drafts" && onGenerateDrafts) {
        await onGenerateDrafts()
      } else {
        const endpoint = action === "scout" ? scoutEndpoint : draftEndpoint
        const payload =
          action === "scout"
            ? scoutPayload ?? { type: "newsroom_cycle", title: "Run Scout cycle", params: {} }
            : draftPayload ?? { type: "newsroom_cycle", title: "Generate newsroom drafts", params: {} }
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `${labelForAction(action)} failed`)
      }

      setNotice({ tone: "good", text: `${labelForAction(action)} queued successfully.` })
      await onRefresh?.()
    } catch (error) {
      console.error("[reporting room]", action, error)
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
        <MetricCard label="Scout Agent" value={scoutStatus.status.toUpperCase()} detail={scoutStatus.note ?? `last run ${formatDate(scoutStatus.lastRunAt)}`} tone={statusTone(scoutStatus.status)} />
        <MetricCard label="Active Agents" value={formatNumber(scoutStatus.activeAgents)} detail={`${formatNumber(scoutStatus.pendingSources)} sources pending`} tone={scoutStatus.activeAgents > 0 ? "good" : "neutral"} />
        <MetricCard label="Generated Drafts" value={formatNumber(generatedDrafts.length)} detail="latest newsroom outputs" />
        <MetricCard label="Coverage Gaps" value={formatNumber(coverageGaps.length)} detail={`${formatNumber(highGaps)} high priority`} tone={highGaps > 0 ? "warn" : "good"} />
      </div>

      <div style={actionRailStyle}>
        <div>
          <div style={panelTitleStyle}>REPORTING ROOM</div>
          <p style={railCopyStyle}>Scout telemetry, generated drafts, candidate stories, topic gaps, and recent collection activity.</p>
        </div>
        <div style={buttonRailStyle}>
          <ActionButton label="RUN SCOUT" loading={working === "scout"} disabled={working !== null} onClick={() => runAction("scout")} />
          <ActionButton label="GENERATE DRAFTS" loading={working === "drafts"} disabled={working !== null} onClick={() => runAction("drafts")} variant="secondary" />
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
            <span>GENERATED DRAFTS</span>
            <span>{sortedDrafts.length}</span>
          </div>
          <div style={listStyle}>
            {sortedDrafts.map((draft) => (
              <article key={draft.id} style={itemStyle}>
                <div style={metaRowStyle}>
                  <span style={{ color: statusColor(draft.status ?? "draft") }}>{(draft.status ?? "draft").toUpperCase()}</span>
                  <span>{draft.topic ?? "general"}</span>
                  <span>{draft.sourceName ?? "unknown source"}</span>
                  <span>{formatDate(draft.createdAt)}</span>
                </div>
                <h3 style={itemTitleStyle}>{draft.title}</h3>
                <p style={descriptionStyle}>{draft.summary ?? "Draft generated by the scout pipeline."}</p>
                {typeof draft.confidence === "number" && <div style={scoreLineStyle}>confidence {formatPercent(draft.confidence)}</div>}
              </article>
            ))}
            {sortedDrafts.length === 0 && <div style={emptyStyle}>No generated drafts supplied.</div>}
          </div>
        </section>

        <section style={sideStackStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <span>STORY CANDIDATES</span>
              <span>{sortedCandidates.length}</span>
            </div>
            <div style={listStyle}>
              {sortedCandidates.slice(0, 8).map((candidate) => (
                <article key={candidate.id} style={compactItemStyle}>
                  <div style={metaRowStyle}>
                    <span style={{ color: "#4af0c4" }}>{candidate.topic.toUpperCase()}</span>
                    <span>{candidate.sourceName ?? "source pending"}</span>
                    {typeof candidate.score === "number" && <span>score {candidate.score.toFixed(1)}</span>}
                  </div>
                  <h3 style={compactTitleStyle}>{candidate.title}</h3>
                  <p style={descriptionStyle}>{candidate.reason ?? "Candidate identified for editorial review."}</p>
                </article>
              ))}
              {sortedCandidates.length === 0 && <div style={emptyStyle}>No story candidates supplied.</div>}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <span>COVERAGE GAPS</span>
              <span>{coverageGaps.length}</span>
            </div>
            <div style={listStyle}>
              {coverageGaps.map((gap) => (
                <article key={gap.id} style={compactItemStyle}>
                  <div style={metaRowStyle}>
                    <span style={{ color: severityColor(gap.severity) }}>{gap.severity.toUpperCase()}</span>
                    <span>{formatNumber(gap.missingSources ?? 0)} missing sources</span>
                    <span>last {formatDate(gap.lastCoveredAt)}</span>
                  </div>
                  <h3 style={compactTitleStyle}>{gap.topic}</h3>
                  <p style={descriptionStyle}>{gap.detail ?? "Coverage gap needs assignment."}</p>
                </article>
              ))}
              {coverageGaps.length === 0 && <div style={emptyStyle}>No coverage gaps supplied.</div>}
            </div>
          </div>
        </section>
      </div>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <span>RECENT SCOUT ACTIVITY</span>
          <span>{recentActivity.length}</span>
        </div>
        <div style={activityGridStyle}>
          {recentActivity.map((activity) => (
            <article key={activity.id} style={activityItemStyle}>
              <span style={{ ...dotStyle, background: statusColor(activity.status) }} />
              <div>
                <div style={activityTitleStyle}>{activity.title}</div>
                <p style={activityDetailStyle}>{activity.detail ?? "Scout event recorded."}</p>
              </div>
              <time style={activityTimeStyle}>{formatDate(activity.createdAt)}</time>
            </article>
          ))}
          {recentActivity.length === 0 && <div style={emptyStyle}>No recent Scout activity supplied.</div>}
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

function labelForAction(action: ReportingAction) {
  return action === "scout" ? "Scout run" : "Draft generation"
}

function dateValue(value?: string | Date | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "running") return "good"
  if (status === "degraded") return "warn"
  if (status === "failed") return "bad"
  return "neutral"
}

function statusColor(status: string) {
  if (status === "success" || status === "ready" || status === "running") return "#4af0c4"
  if (status === "warning" || status === "needs-review" || status === "draft") return "#f5c542"
  if (status === "failure" || status === "failed") return "#ff6b6b"
  return "#9fb0c5"
}

function severityColor(severity: string) {
  if (severity === "critical" || severity === "high") return "#ff6b6b"
  if (severity === "medium") return "#f5c542"
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

function formatPercent(value: number) {
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
const mainGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(340px, 0.8fr)", gap: 16 }
const sideStackStyle: CSSProperties = { display: "grid", gap: 16, alignContent: "start" }
const panelStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.18)", background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, overflow: "hidden" }
const panelHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderBottom: "1px solid rgba(148, 163, 184, 0.16)", color: "#e2e8f0", fontSize: 12, fontWeight: 800, letterSpacing: 0 }
const listStyle: CSSProperties = { display: "grid", gap: 10, padding: 12 }
const itemStyle: CSSProperties = { padding: 12, border: "1px solid rgba(148, 163, 184, 0.14)", borderRadius: 8, background: "rgba(2, 8, 23, 0.42)" }
const compactItemStyle: CSSProperties = { padding: 11, border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: 8, background: "rgba(2, 8, 23, 0.34)" }
const metaRowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", color: "#8da0b8", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }
const itemTitleStyle: CSSProperties = { margin: "7px 0 5px", color: "#f8fafc", fontSize: 15, lineHeight: 1.35 }
const compactTitleStyle: CSSProperties = { margin: "7px 0 5px", color: "#f8fafc", fontSize: 14, lineHeight: 1.35 }
const descriptionStyle: CSSProperties = { margin: 0, color: "#a8b6c7", fontSize: 13, lineHeight: 1.5 }
const scoreLineStyle: CSSProperties = { marginTop: 8, color: "#4af0c4", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }
const activityGridStyle: CSSProperties = { display: "grid" }
const activityItemStyle: CSSProperties = { display: "grid", gridTemplateColumns: "10px minmax(0, 1fr) 120px", gap: 10, alignItems: "start", padding: "11px 14px", borderTop: "1px solid rgba(148, 163, 184, 0.12)" }
const dotStyle: CSSProperties = { width: 8, height: 8, borderRadius: 99, marginTop: 5 }
const activityTitleStyle: CSSProperties = { color: "#f8fafc", fontSize: 13, fontWeight: 800 }
const activityDetailStyle: CSSProperties = { margin: "3px 0 0", color: "#8da0b8", fontSize: 12, lineHeight: 1.4 }
const activityTimeStyle: CSSProperties = { color: "#64748b", fontSize: 11, textAlign: "right" }
const emptyStyle: CSSProperties = { padding: 18, color: "#64748b", textAlign: "center" }
const noticeStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid", borderRadius: 8, background: "rgba(2, 8, 23, 0.82)", color: "#e2e8f0", fontSize: 13 }
const noticeCloseStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.26)", background: "transparent", color: "#cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 11, fontWeight: 800 }
const primaryButtonStyle: CSSProperties = { border: "1px solid rgba(74, 240, 196, 0.55)", background: "rgba(74, 240, 196, 0.16)", color: "#dffff6", borderRadius: 6, padding: "9px 11px", cursor: "pointer", fontSize: 11, fontWeight: 900 }
const secondaryButtonStyle: CSSProperties = { border: "1px solid rgba(148, 163, 184, 0.28)", background: "rgba(15, 23, 42, 0.72)", color: "#d7e1ee", borderRadius: 6, padding: "9px 11px", cursor: "pointer", fontSize: 11, fontWeight: 900 }

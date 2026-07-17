"use client"

import type { CSSProperties } from "react"
import { useMemo, useState, useTransition } from "react"
import { runMissingSummaries, runMissingTaxonomy, runMissingSentiment, runAllMissing } from "@/app/admin/ai-manager/copy-desk/actions"

export type CopyDeskQueueKind = "summary" | "tags" | "sentiment"
type CopyDeskJobTask = "summarize" | "tag" | "sentiment"

export type CopyDeskArticle = {
  id: string
  title: string
  source: string
  topic: string
  createdAt?: string | null
  summary?: string | null
  aiTags?: string | null
  sentiment?: string | null
  priority?: "low" | "normal" | "high" | "urgent"
}

export type CopyDeskTopicBacklogRow = {
  topic: string
  total: number
  missingSummary: number
  missingTags: number
  missingSentiment: number
  oldestArticleAt?: string | null
}

export type CopyDeskActionCard = {
  id: string
  label: string
  description: string
  queue?: CopyDeskQueueKind | "all"
  topic?: string
  count?: number
  tone?: "neutral" | "good" | "warn" | "bad"
  buttonLabel: string
  jobType?: "ai_batch"
  params?: Record<string, unknown>
}

export type CopyDeskModuleProps = {
  articles: CopyDeskArticle[]
  topicBacklog: CopyDeskTopicBacklogRow[]
  actions: CopyDeskActionCard[]
  onAction?: (action: CopyDeskActionCard) => void | Promise<void>
  onQueueAction?: (queue: CopyDeskQueueKind, articles: CopyDeskArticle[]) => void | Promise<void>
  onTopicAction?: (topic: string, row: CopyDeskTopicBacklogRow) => void | Promise<void>
  onArticleSelect?: (article: CopyDeskArticle, queue: CopyDeskQueueKind) => void
  jobEndpoint?: string
}

type QueueConfig = {
  kind: CopyDeskQueueKind
  label: string
  emptyLabel: string
  accent: string
}

const QUEUES: QueueConfig[] = [
  {
    kind: "summary",
    label: "Missing Summaries",
    emptyLabel: "All summaries are drafted.",
    accent: "#a78bfa",
  },
  {
    kind: "tags",
    label: "Missing Tags",
    emptyLabel: "All tag sets are filled.",
    accent: "#6c8fff",
  },
  {
    kind: "sentiment",
    label: "Missing Sentiment",
    emptyLabel: "All sentiment reads are scored.",
    accent: "#4af0c4",
  },
]

export default function CopyDeskModule({
  articles,
  topicBacklog,
  actions,
  onAction,
  onQueueAction,
  onTopicAction,
  onArticleSelect,
  jobEndpoint = "/api/admin/ai/jobs",
}: CopyDeskModuleProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    tone: "good" | "warn" | "bad"
    text: string
  } | null>(null)
  const isBusy = loading !== null

  const queues = useMemo(
    () => ({
      summary: articles.filter((article) => !article.summary),
      tags: articles.filter((article) => !article.aiTags),
      sentiment: articles.filter((article) => !article.sentiment),
    }),
    [articles]
  )

  const totals = useMemo(
    () => ({
      summary: queues.summary.length,
      tags: queues.tags.length,
      sentiment: queues.sentiment.length,
      all: new Set([
        ...queues.summary.map((article) => article.id),
        ...queues.tags.map((article) => article.id),
        ...queues.sentiment.map((article) => article.id),
      ]).size,
    }),
    [queues]
  )

  async function runWithLoading(key: string, callback?: () => void | Promise<void>) {
    if (!callback) return
    setLoading(key)
    setNotice(null)
    try {
      await callback()
      setNotice({ tone: "good", text: "Request queued." })
    } catch (error) {
      setNotice({
        tone: "warn",
        text: error instanceof Error ? error.message : "Request failed.",
      })
    } finally {
      setLoading(null)
    }
  }

  async function queueJob(action: CopyDeskActionCard) {
    const res = await fetch(jobEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: action.jobType ?? "ai_batch",
        title: action.label,
        params: action.params ?? {
          task: action.queue && action.queue !== "all" ? getJobTaskForQueue(action.queue) : "all",
          topic: action.topic,
          limit: 30,
        },
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error)
          : "Copy desk job request failed"
      if (res.status === 409) {
        throw new Error(`${message}. Wait for it to finish or cancel it in Operations.`)
      }
      throw new Error(message)
    }
  }

  async function queueKindJob(queue: CopyDeskQueueKind, queueArticles: CopyDeskArticle[]) {
    const task = getJobTaskForQueue(queue)
    await queueJob({
      id: `queue-${queue}`,
      label: `Run ${queue} queue`,
      description: `Process ${queueArticles.length} copy desk articles.`,
      queue,
      count: queueArticles.length,
      buttonLabel: "Run queue",
      params: { task, limit: Math.min(queueArticles.length, 50) },
    })
  }

  const sortedBacklog = [...topicBacklog].sort(
    (a, b) => backlogTotal(b) - backlogTotal(a) || a.topic.localeCompare(b.topic)
  )

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COPY DESK</div>
          <h2 style={titleStyle}>Summary, tag, and sentiment backlog</h2>
          <p style={copyStyle}>
            Triage articles that still need editorial AI enrichment, then work the largest
            topic gaps first.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
          <div style={statsGridStyle}>
            <Metric label="Articles" value={totals.all} tone={totals.all > 0 ? "warn" : "good"} />
            <Metric label="Summaries" value={totals.summary} tone={totals.summary > 0 ? "warn" : "good"} />
            <Metric label="Tags" value={totals.tags} tone={totals.tags > 0 ? "warn" : "good"} />
            <Metric label="Mood" value={totals.sentiment} tone={totals.sentiment > 0 ? "warn" : "good"} />
          </div>
          <button
            type="button"
            disabled={isBusy || totals.all === 0}
            onClick={() => runWithLoading("run_all", () => runAllMissing())}
            style={buttonStateStyle(primaryButtonStyle, isBusy || totals.all === 0, loading === "run_all")}
          >
            {loading === "run_all" ? "QUEUING..." : "RUN ALL MISSING"}
          </button>
        </div>
      </header>

      <section style={actionGridStyle} aria-label="Copy desk actions">
        {actions.map((action) => (
          <article key={action.id} style={actionCardStyle}>
            <div style={actionMetaStyle}>
              <span style={{ color: toneColor(action.tone) }}>{action.queue ?? action.topic ?? "desk"}</span>
              {typeof action.count === "number" && <span>{action.count}</span>}
            </div>
            <h3 style={cardTitleStyle}>{action.label}</h3>
            <p style={cardCopyStyle}>{action.description}</p>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => runWithLoading(`action:${action.id}`, () => onAction ? onAction(action) : queueJob(action))}
              style={buttonStateStyle(primaryButtonStyle, isBusy, loading === `action:${action.id}`)}
            >
              {loading === `action:${action.id}` ? "WORKING..." : action.buttonLabel}
            </button>
          </article>
        ))}
        {actions.length === 0 && <div style={emptyBlockStyle}>No copy desk actions configured.</div>}
      </section>

      {notice && (
        <div style={noticeStyle(notice.tone)} role="status">
          {notice.text}
        </div>
      )}

      <section style={queueGridStyle} aria-label="Missing copy desk queues">
        {QUEUES.map((queue) => {
          const items = queues[queue.kind]
          return (
            <article key={queue.kind} style={panelStyle}>
              <div style={panelHeaderStyle}>
                <span style={{ color: queue.accent }}>{queue.label}</span>
                <button
                  type="button"
                  disabled={items.length === 0 || isBusy}
                  onClick={() =>
                    runWithLoading(`queue:${queue.kind}`, () => {
                      if (queue.kind === "summary") return runMissingSummaries()
                      if (queue.kind === "tags") return runMissingTaxonomy()
                      if (queue.kind === "sentiment") return runMissingSentiment()
                    })
                  }
                  style={buttonStateStyle(smallButtonStyle, items.length === 0 || isBusy, loading === `queue:${queue.kind}`)}
                >
                  {loading === `queue:${queue.kind}` ? "QUEUING..." : `RUN ${items.length}`}
                </button>
              </div>
              <div style={queueListStyle}>
                {items.slice(0, 8).map((article) => (
                  <button
                    key={`${queue.kind}:${article.id}`}
                    type="button"
                    onClick={() => onArticleSelect?.(article, queue.kind)}
                    style={articleButtonStyle}
                  >
                    <span style={articleTitleStyle}>{article.title}</span>
                    <span style={articleMetaStyle}>
                      {article.topic} / {article.source}
                      {article.priority && article.priority !== "normal" ? ` / ${article.priority}` : ""}
                    </span>
                  </button>
                ))}
                {items.length > 8 && <div style={moreStyle}>+{items.length - 8} more waiting</div>}
                {items.length === 0 && <div style={emptyBlockStyle}>{queue.emptyLabel}</div>}
              </div>
            </article>
          )
        })}
      </section>

      <section style={panelStyle} aria-label="Per-topic copy backlog">
        <div style={panelHeaderStyle}>
          <span>PER-TOPIC BACKLOG</span>
          <span>{sortedBacklog.length} TOPICS</span>
        </div>
        <div style={tableStyle}>
          <div style={{ ...rowStyle, ...headRowStyle }}>
            <span>Topic</span>
            <span>Total</span>
            <span>Summary</span>
            <span>Tags</span>
            <span>Mood</span>
            <span>Action</span>
          </div>
          {sortedBacklog.map((row) => (
            <div key={row.topic} style={rowStyle}>
              <strong style={topicStyle}>{row.topic}</strong>
              <span>{row.total}</span>
              <span style={{ color: countColor(row.missingSummary) }}>{row.missingSummary}</span>
              <span style={{ color: countColor(row.missingTags) }}>{row.missingTags}</span>
              <span style={{ color: countColor(row.missingSentiment) }}>{row.missingSentiment}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  disabled={row.missingSummary === 0 || isBusy}
                  onClick={() => runWithLoading(`topic:summary:${row.topic}`, () => runMissingSummaries(row.topic))}
                  style={buttonStateStyle(
                    smallButtonStyle,
                    row.missingSummary === 0 || isBusy,
                    loading === `topic:summary:${row.topic}`
                  )}
                >
                  {loading === `topic:summary:${row.topic}` ? "..." : `Summaries (${row.missingSummary})`}
                </button>
                <button
                  type="button"
                  disabled={row.missingTags === 0 || isBusy}
                  onClick={() => runWithLoading(`topic:tags:${row.topic}`, () => runMissingTaxonomy(row.topic))}
                  style={buttonStateStyle(
                    smallButtonStyle,
                    row.missingTags === 0 || isBusy,
                    loading === `topic:tags:${row.topic}`
                  )}
                >
                  {loading === `topic:tags:${row.topic}` ? "..." : `Tags (${row.missingTags})`}
                </button>
                <button
                  type="button"
                  disabled={row.missingSentiment === 0 || isBusy}
                  onClick={() => runWithLoading(`topic:sentiment:${row.topic}`, () => runMissingSentiment(row.topic))}
                  style={buttonStateStyle(
                    smallButtonStyle,
                    row.missingSentiment === 0 || isBusy,
                    loading === `topic:sentiment:${row.topic}`
                  )}
                >
                  {loading === `topic:sentiment:${row.topic}` ? "..." : `Sentiment (${row.missingSentiment})`}
                </button>
              </div>
            </div>
          ))}
          {sortedBacklog.length === 0 && <div style={emptyBlockStyle}>No topic backlog rows.</div>}
        </div>
      </section>
    </div>
  )
}

function getJobTaskForQueue(queue: CopyDeskQueueKind): CopyDeskJobTask {
  if (queue === "summary") return "summarize"
  if (queue === "tags") return "tag"
  return "sentiment"
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

function backlogTotal(row: CopyDeskTopicBacklogRow) {
  return row.missingSummary + row.missingTags + row.missingSentiment
}

function toneColor(tone: CopyDeskActionCard["tone"] = "neutral") {
  if (tone === "good") return "#4af0c4"
  if (tone === "warn") return "#f5c542"
  if (tone === "bad") return "#ff6b6b"
  return "var(--accent)"
}

function countColor(value: number) {
  return value > 0 ? "#f5c542" : "#4af0c4"
}

function noticeStyle(tone: "good" | "warn" | "bad"): CSSProperties {
  const color =
    tone === "good" ? "#4af0c4" : tone === "bad" ? "#ff6b6b" : "#f5c542"
  return {
    padding: "10px 12px",
    background: `${color}14`,
    border: `1px solid ${color}55`,
    borderRadius: 5,
    color,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    lineHeight: 1.5,
  }
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
  gap: 16,
}

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) minmax(280px, 520px)",
  gap: 18,
  alignItems: "start",
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
  maxWidth: 660,
}

const statsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(70px, 1fr))",
  gap: 8,
}

const metricStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  minHeight: 68,
  padding: 12,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
}

const actionCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  alignContent: "space-between",
  minHeight: 166,
  padding: 14,
  background: "rgba(108,143,255,0.08)",
  border: "1px solid rgba(108,143,255,0.24)",
  borderRadius: 6,
}

const actionMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.35,
}

const cardCopyStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.55,
}

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  color: "#000",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const queueGridStyle: CSSProperties = {
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
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const smallButtonStyle: CSSProperties = {
  minHeight: 28,
  padding: "5px 8px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const queueListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const articleButtonStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  width: "100%",
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "left",
}

const articleTitleStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
}

const articleMetaStyle: CSSProperties = {
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
}

const moreStyle: CSSProperties = {
  padding: "6px 2px",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const tableStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  overflowX: "auto",
}

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(130px, 1.4fr) repeat(4, minmax(64px, 0.45fr)) minmax(280px, 1.5fr)",
  gap: 8,
  alignItems: "center",
  minWidth: 660,
  padding: 10,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const headRowStyle: CSSProperties = {
  background: "transparent",
  color: "var(--muted)",
  borderColor: "transparent",
}

const topicStyle: CSSProperties = {
  color: "var(--text)",
  textTransform: "uppercase",
}

const emptyBlockStyle: CSSProperties = {
  padding: 16,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "center",
}

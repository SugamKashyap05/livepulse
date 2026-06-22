"use client"

import Link from "next/link"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import MainEditorInboxPanel from "@/components/admin/MainEditorInboxPanel"

type Log = {
  id: string
  action: string
  model: string
  ms: number | null
  tokens: number | null
  success: boolean
  error: string | null
  createdAt: string
}

type Digest = {
  id: string
  date: string
  content: string
  model: string | null
  createdAt: string
}

type Models = Record<string, string>

type ActionCard = {
  jobType: "newsroom_cycle" | "rag_reindex" | "ai_batch" | "digest_generate"
  label: string
  params: Record<string, unknown>
  confirmLabel: string
}

type ManagerMessage = {
  id?: string
  role: string
  content: string
  metadata?: {
    actionCards?: ActionCard[]
    [key: string]: unknown
  } | null
  jobId?: string | null
  createdAt?: string
}

type AdminJob = {
  id: string
  type: string
  status: string
  title: string
  error?: string | null
  retryCount?: number
  maxRetries?: number
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

type CoverageRow = {
  topic: string
  total: number
  missingSummary: number
  missingTags: number
  missingSentiment: number
  ragIndexed: number
}

type JobPreview = {
  title: string
  affectedCount: number
  affectedLabel: string
  estimate: string
  affectedTopics: string[]
  warnings: string[]
}

type DepartmentEvent = {
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

type DepartmentSummary = {
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
  unreadCount: number
  needsEditorReviewCount: number
  activeJobs: number
  failedJobs: number
  latestEvents: DepartmentEvent[]
}

type StreamEvent = {
  type?: string
  content?: string
  actionCards?: ActionCard[]
  card?: ActionCard
  jobType?: ActionCard["jobType"]
  label?: string
  params?: Record<string, unknown>
  confirmLabel?: string
}

type LocalNotice = {
  id: string
  tone: "info" | "warn" | "bad"
  text: string
}

type EditorSession = {
  id: string
  title: string
  status: string
  memoryStatus: string
  pinnedContextStatus: string
  messageCount: number
  updatedAt?: string | null
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isConversationMessage(message: ManagerMessage) {
  if (message.jobId) return false

  const metadata = metadataRecord(message.metadata)
  const event = metadata.event
  const source = metadata.source
  const type = metadata.type
  if (typeof event === "string") {
    const normalized = event.toLowerCase()
    if (
      normalized.startsWith("job") ||
      normalized.startsWith("task") ||
      normalized.startsWith("system")
    ) {
      return false
    }
  }
  if (
    source === "job" ||
    source === "department" ||
    source === "notification" ||
    source === "system" ||
    type === "job_failure"
  ) {
    return false
  }

  return message.role === "user" || message.role === "assistant"
}

function actionCardKey(card: ActionCard) {
  return `${card.jobType}:${card.label}:${JSON.stringify(card.params ?? {})}`
}

function uniqueActionCards(cards: ActionCard[]) {
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = actionCardKey(card)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isLikelySameLocalMessage(a: ManagerMessage, b: ManagerMessage) {
  if (a.id || !b.id) return false
  if (a.role !== b.role) return false
  return a.content.trim() === b.content.trim()
}

function generateNoticeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function AiManagerClient({
  logs,
  digests,
  models,
  initialMessages,
  coverageByTopic,
  departmentSummaries,
  editorInbox,
}: {
  logs: Log[]
  digests: Digest[]
  models: Models
  initialMessages: ManagerMessage[]
  coverageByTopic: CoverageRow[]
  departmentSummaries: DepartmentSummary[]
  editorInbox: DepartmentEvent[]
}) {
  const [tab, setTab] = useState<"chat" | "logs" | "digests">("chat")
  const [messages, setMessages] = useState<ManagerMessage[]>(
    initialMessages.filter(isConversationMessage)
  )
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [jobLoading, setJobLoading] = useState<string | null>(null)
  const [recoveringJobs, setRecoveringJobs] = useState(false)
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [inboxEvents, setInboxEvents] = useState<DepartmentEvent[]>(editorInbox)
  const [localNotices, setLocalNotices] = useState<LocalNotice[]>([])
  const [sessions, setSessions] = useState<EditorSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState("legacy-main-editor")
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsCanCreate, setSessionsCanCreate] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [actionCards, setActionCards] = useState<ActionCard[]>([])
  const [preview, setPreview] = useState<{
    card: ActionCard
    data: JobPreview
  } | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageTimestamp = useRef(
    initialMessages.at(-1)?.createdAt
      ? new Date(initialMessages.at(-1)?.createdAt as string)
      : new Date()
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [streamingContent, messages])

  function addLocalNotice(tone: LocalNotice["tone"], text: string) {
    const id = generateNoticeId()
    setLocalNotices((prev) => [...prev.slice(-2), { id, tone, text }])
  }

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch("/api/admin/ai/editor/sessions")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data.error ?? "Session load failed"))
      if (Array.isArray(data.sessions)) setSessions(data.sessions)
      if (typeof data.activeSessionId === "string") {
        setActiveSessionId(data.activeSessionId)
      }
      setSessionsCanCreate(Boolean(data.canCreate))
      setSessionError(
        typeof data.reason === "string" && data.schemaReady === false ? data.reason : null
      )
    } catch (error) {
      console.error("[manager sessions] refresh failed:", error)
      setSessionError(
        error instanceof Error ? error.message : "Could not load editor sessions."
      )
      setSessionsCanCreate(false)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  async function createEditorSession() {
    setSessionsLoading(true)
    try {
      const res = await fetch("/api/admin/ai/editor/sessions", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data.error ?? "Session creation failed"))
      await refreshSessions()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Session creation is not available yet."
      setSessionError(message)
      addLocalNotice("warn", message)
    } finally {
      setSessionsLoading(false)
    }
  }

  const refreshMessages = useCallback(async () => {
    setMessagesLoading(true)
    try {
      const params = new URLSearchParams({ sessionId: activeSessionId })
      const res = await fetch(`/api/admin/ai/manager/messages?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data.error ?? "Message load failed"))
      if (Array.isArray(data.messages)) {
        const conversationMessages = data.messages.filter(isConversationMessage)
        setMessages(conversationMessages)
        const last = conversationMessages.at(-1) as ManagerMessage | undefined
        if (last?.createdAt) lastMessageTimestamp.current = new Date(last.createdAt)
      }
      setMessagesError(null)
    } catch (error) {
      console.error("[manager messages] refresh failed:", error)
      setMessagesError(
        error instanceof Error ? error.message : "Could not load this chat session."
      )
    } finally {
      setMessagesLoading(false)
    }
  }, [activeSessionId])

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/jobs")
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.jobs)) setJobs(data.jobs)
    } catch (error) {
      console.error("[manager jobs] refresh failed:", error)
    }
  }, [])

  const refreshEditorInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/editor/inbox")
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.events)) setInboxEvents(data.events)
    } catch (error) {
      console.error("[manager editor inbox] refresh failed:", error)
    }
  }, [])

  async function recoverJobs() {
    if (recoveringJobs) return
    setRecoveringJobs(true)
    try {
      const res = await fetch("/api/admin/ai/jobs/run-next", { method: "POST" })
      if (!res.ok) throw new Error("Pipeline check failed")
      addLocalNotice("info", "Pipeline check requested. Job updates stay in Room Activity.")
      await Promise.all([refreshJobs(), refreshEditorInbox()])
    } catch (error) {
      console.error("[manager jobs] recover failed:", error)
      addLocalNotice("bad", "Could not check the pipeline. Check admin logs and try again.")
    } finally {
      setRecoveringJobs(false)
    }
  }

  async function previewJob(card: ActionCard) {
    const key = `${card.jobType}:${card.label}`
    setJobLoading(key)
    try {
      const res = await fetch("/api/admin/ai/jobs/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: card.jobType, params: card.params }),
      })
      if (!res.ok) throw new Error("Preview request failed")
      const data = await res.json()
      if (data.preview) setPreview({ card, data: data.preview })
    } catch (error) {
      console.error("[manager job] preview failed:", error)
      addLocalNotice("bad", "Could not preview that task. Check the admin logs and try again.")
    } finally {
      setJobLoading(null)
    }
  }

  useEffect(() => {
    let active = true
    const init = async () => {
      if (!active) return
      await refreshSessions()
      await refreshJobs()
      await refreshEditorInbox()
    }
    init()
    const interval = setInterval(() => {
      if (active) refreshJobs()
    }, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [refreshSessions, refreshJobs, refreshEditorInbox])

  useEffect(() => {
    let active = true
    const init = async () => {
      if (!active) return
      await refreshMessages()
    }
    init()
    return () => {
      active = false
    }
  }, [activeSessionId, refreshMessages])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/admin/ai/manager/messages?after=${lastMessageTimestamp.current.toISOString()}&sessionId=${encodeURIComponent(activeSessionId)}`
        )
        if (!res.ok) return
        const data = await res.json()
        const newMsgs = Array.isArray(data.messages) ? data.messages : []
        if (newMsgs.length > 0) {
          const conversationMessages = newMsgs.filter(isConversationMessage)
          if (conversationMessages.length === 0) return
          setMessages((prev) => {
            const existingIds = new Set(prev.map((message) => message.id))
            const filteredMessages = conversationMessages.filter(
              (message: ManagerMessage) => {
                if (message.id && existingIds.has(message.id)) return false
                return !prev.some((existing) =>
                  isLikelySameLocalMessage(existing, message)
                )
              }
            )
            return [
              ...prev,
              ...filteredMessages,
            ]
          })
          const last = conversationMessages.at(-1) as ManagerMessage | undefined
          if (last?.createdAt) lastMessageTimestamp.current = new Date(last.createdAt)
        }
      } catch (error) {
        console.error("[manager messages] job poll failed:", error)
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [activeSessionId])

  async function sendToManager(
    text: string = input,
    editorContext?: Record<string, unknown>
  ) {
    if (!text.trim() || loading) return

    const userMsg = { role: "user", content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    setIsThinking(true)
    setStreamingContent("")
    setActionCards([])

    try {
      const res = await fetch("/api/ai/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          sessionId: activeSessionId,
          editorContext,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error("Request failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let buffer = ""
      const actionCards: ActionCard[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const rawEvent of events) {
          const line = rawEvent
            .split("\n")
            .find((eventLine) => eventLine.startsWith("data: "))
          if (!line) continue

          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent

            if (event.type === "start") {
              setIsThinking(false)
            }

            if (event.type === "token" && typeof event.content === "string") {
              accumulated += event.content
              setStreamingContent(accumulated)
            }

            if (event.type === "action_card") {
              const card = event.card ??
                (event.jobType && event.label
                  ? {
                      jobType: event.jobType,
                      label: event.label,
                      params: event.params ?? {},
                      confirmLabel: event.confirmLabel ?? "Start task",
                    }
                  : null)

              if (card) {
                actionCards.push(card)
                setActionCards((prev) => uniqueActionCards([...prev, card]))
              }
            }

            if (event.type === "done") {
              const finalContent =
                typeof event.content === "string" ? event.content : accumulated
              const finalActionCards = uniqueActionCards(
                Array.isArray(event.actionCards) && event.actionCards.length > 0
                  ? event.actionCards
                  : actionCards
              )
              setStreamingContent("")
              setActionCards([])
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: finalContent || "No response",
                  metadata:
                    finalActionCards.length > 0
                      ? { actionCards: finalActionCards }
                      : undefined,
                },
              ])
            }

            if (event.type === "error") {
              setStreamingContent("")
              addLocalNotice(
                "bad",
                event.content || "AI service unavailable. Check that Ollama is running."
              )
            }
          } catch {
            // Malformed SSE line; skip it.
          }
        }
      }
    } catch (e) {
      console.error("[manager client] stream error:", e)
      setStreamingContent("")
      addLocalNotice("bad", "AI service unavailable. Check that Ollama is running.")
    } finally {
      setLoading(false)
      setIsThinking(false)
      setStreamingContent("")
      setTimeout(() => {
        refreshMessages()
        refreshEditorInbox()
      }, 500)
    }
  }

  async function createJob(card: ActionCard) {
    const key = `${card.jobType}:${card.label}`
    setJobLoading(key)
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
      if (res.status === 409) {
        addLocalNotice("warn", "This task is already running. Check Room Activity for status.")
        return
      }
      if (!res.ok) throw new Error("Job request failed")
      setActionCards([])
      setPreview(null)
      addLocalNotice("info", "Confirmed task was queued. Progress will appear outside chat.")
      await refreshJobs()
    } catch (error) {
      console.error("[manager job] create failed:", error)
      addLocalNotice("bad", "Could not queue that task. Check the admin logs and try again.")
    } finally {
      setJobLoading(null)
    }
  }

  async function updateJobStatus(jobId: string, action: "cancel" | "retry") {
    setJobLoading(`${action}:${jobId}`)
    try {
      const res = await fetch(`/api/admin/ai/jobs/${jobId}/${action}`, {
        method: "POST",
      })
      if (!res.ok) throw new Error(`${action} failed`)
      addLocalNotice("info", `${action === "cancel" ? "Cancel" : "Retry"} request sent.`)
      await refreshJobs()
    } catch (error) {
      console.error("[manager job]", action, "failed:", error)
      addLocalNotice("bad", `Could not ${action} that task. Check the admin logs and try again.`)
    } finally {
      setJobLoading(null)
    }
  }

  const TABS = [
    { key: "chat", label: "Editor Chat Office" },
    { key: "logs", label: `Activity Logs (${logs.length})` },
    { key: "digests", label: `Digest Room (${digests.length})` },
  ]

  const suggestions = [
    "What topics are trending today?",
    "Which sources have the most articles?",
    "Suggest 3 new RSS feeds to add",
    "What's the sentiment breakdown?",
    "How is the site performing?",
    "What news is most important today?",
  ]
  const activeJobs = jobs.filter((job) =>
    job.status === "queued" || job.status === "running"
  )
  const failedJobs = jobs.filter((job) =>
    job.status === "failed" || job.status === "dead_letter"
  )
  const quickActions: ActionCard[] = [
    {
      jobType: "ai_batch",
      label: "Run sentiment batch",
      params: { task: "sentiment", limit: 30 },
      confirmLabel: "Preview sentiment",
    },
    {
      jobType: "ai_batch",
      label: "Run tag batch",
      params: { task: "tag", limit: 30 },
      confirmLabel: "Preview tags",
    },
    {
      jobType: "ai_batch",
      label: "Run summary batch",
      params: { task: "summarize", limit: 20 },
      confirmLabel: "Preview summaries",
    },
    {
      jobType: "ai_batch",
      label: "Run full AI batch",
      params: { task: "all", limit: 20 },
      confirmLabel: "Preview full batch",
    },
    {
      jobType: "newsroom_cycle",
      label: "Run newsroom cycle",
      params: {},
      confirmLabel: "Preview newsroom",
    },
    {
      jobType: "rag_reindex",
      label: "Reindex RAG",
      params: { mode: "missing", limit: 50 },
      confirmLabel: "Preview RAG",
    },
    {
      jobType: "digest_generate",
      label: "Generate digest",
      params: { regen: true },
      confirmLabel: "Preview digest",
    },
  ]
  const latestLogs = logs.slice(0, 5)
  const coverageTotals = coverageByTopic.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      missingSummary: acc.missingSummary + row.missingSummary,
      missingTags: acc.missingTags + row.missingTags,
      missingSentiment: acc.missingSentiment + row.missingSentiment,
      ragIndexed: acc.ragIndexed + row.ragIndexed,
    }),
    {
      total: 0,
      missingSummary: 0,
      missingTags: 0,
      missingSentiment: 0,
      ragIndexed: 0,
    }
  )
  const ragPercent =
    coverageTotals.total > 0
      ? Math.round((coverageTotals.ragIndexed / coverageTotals.total) * 100)
      : 0
  const departmentRooms = departmentSummaries
  const officeActivity = [
    ...activeJobs.map((job) => ({
      id: `job-${job.id}`,
      room: "Operations Room",
      title: job.title,
      meta: job.status.toUpperCase(),
      tone: "active",
      job,
    })),
    ...failedJobs.map((job) => ({
      id: `failed-${job.id}`,
      room: "Verification Room",
      title: job.title,
      meta: job.status.toUpperCase(),
      tone: "failed",
      job,
    })),
    ...latestLogs.map((log) => ({
      id: `log-${log.id}`,
      room: log.success ? "Copy Desk" : "Operations Room",
      title: log.action,
      meta: log.success ? `${log.model} ${log.ms ?? 0}ms` : log.error ?? "FAILED",
      tone: log.success ? "done" : "failed",
      job: null,
    })),
  ].slice(0, 10)
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null

  return (
    <div>
      <section style={commandLobbyStyle}>
        <div style={lobbyHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>COMMAND LOBBY</div>
            <h2 style={sectionHeadingStyle}>Private newsroom control floor</h2>
            <p style={sectionCopyStyle}>
              Run jobs from the lobby, watch departments from their rooms, and keep
              editor chat for decisions instead of raw agent noise.
            </p>
          </div>
          <div style={lobbyStatusGridStyle}>
            <div style={lobbyStatusCardStyle}>
              <span>Active Tasks</span>
              <strong>{activeJobs.length}</strong>
            </div>
            <div style={lobbyStatusCardStyle}>
              <span>Failures</span>
              <strong>{failedJobs.length}</strong>
            </div>
            <div style={lobbyStatusCardStyle}>
              <span>RAG Indexed</span>
              <strong>{ragPercent}%</strong>
            </div>
          </div>
        </div>

        <div style={modelsRailStyle}>
          <span style={railLabelStyle}>Active Models</span>
          {Object.entries(models).map(([task, model]) => (
            <div key={task} style={modelPillWrapStyle}>
              <span style={modelTaskStyle}>{task}</span>
              <span style={modelPillStyle}>{model}</span>
            </div>
          ))}
        </div>

        <div style={controlPlaneGridStyle}>
          <section style={controlPanelStyle}>
            <div style={panelTitleStyle}>LOBBY QUICK ACTIONS</div>
            <div style={quickActionGridStyle}>
              {quickActions.map((card) => {
                const key = `${card.jobType}:${card.label}`
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => previewJob(card)}
                    disabled={jobLoading !== null}
                    style={{
                      ...quickActionButtonStyle,
                      opacity: jobLoading === key ? 0.6 : 1,
                      cursor: jobLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    <span>{card.label}</span>
                    <span style={actionCardHintStyle}>
                      {jobLoading === key ? "PREVIEWING..." : card.confirmLabel}
                    </span>
                  </button>
                )
              })}
            </div>
            {preview && (
              <div style={previewStyle}>
                <div style={previewHeaderStyle}>
                  <span>{preview.data.title}</span>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    disabled={jobLoading !== null}
                    style={buttonStateStyle(smallGhostButtonStyle, jobLoading !== null)}
                  >
                    CLOSE
                  </button>
                </div>
                <div style={previewMetricStyle}>
                  This will process {preview.data.affectedCount}{" "}
                  {preview.data.affectedLabel}. Estimated runtime:{" "}
                  {preview.data.estimate}.
                </div>
                {preview.data.affectedTopics.length > 0 && (
                  <div style={previewMetaStyle}>
                    Topics: {preview.data.affectedTopics.join(", ")}
                  </div>
                )}
                {preview.data.warnings.map((warning) => (
                  <div key={warning} style={previewWarningStyle}>
                    {warning}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => createJob(preview.card)}
                  disabled={jobLoading !== null}
                  style={buttonStateStyle(runPreviewButtonStyle, jobLoading !== null, jobLoading !== null)}
                >
                  {jobLoading ? "QUEUING..." : "RUN CONFIRMED JOB"}
                </button>
              </div>
            )}
          </section>

          <section style={controlPanelStyle}>
            <div style={panelTitleStyle}>TOPIC COVERAGE BOARD</div>
            <div style={coverageTableStyle}>
              <div style={coverageHeaderStyle}>
                <span>Topic</span>
                <span>Missing Sum</span>
                <span>Missing Tags</span>
                <span>Missing Mood</span>
                <span>RAG</span>
              </div>
              {coverageByTopic.map((row) => (
                <div key={row.topic} style={coverageRowStyle}>
                  <span>{row.topic}</span>
                  <span>{row.missingSummary}</span>
                  <span>{row.missingTags}</span>
                  <span>{row.missingSentiment}</span>
                  <span>
                    {row.total > 0 ? Math.round((row.ragIndexed / row.total) * 100) : 0}%
                  </span>
                </div>
              ))}
              {coverageByTopic.length === 0 && (
                <div style={emptyCoverageStyle}>No article coverage data yet</div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section style={officeFloorStyle}>
        <div style={officeRoomsPanelStyle}>
          <div style={sectionEyebrowStyle}>DEPARTMENT ROOMS</div>
          <div style={departmentGridStyle}>
            {departmentRooms.map((room) => (
              <Link key={room.id} href={room.route} style={departmentCardLinkStyle}>
              <article style={departmentCardStyle}>
                <div style={departmentHeaderStyle}>
                  <span>{room.label}</span>
                  <small>{room.agent}</small>
                </div>
                <strong style={departmentStatusStyle}>
                  {room.activeJobs} active · {room.failedJobs} failed
                </strong>
                <p style={departmentCopyStyle}>{room.description}</p>
                {room.staff && room.staff.length > 0 && (
                  <div style={departmentStaffStyle}>
                    {room.staff.slice(0, 3).map((member) => (
                      <span key={`${room.id}-${member.name}`}>{member.role}</span>
                    ))}
                  </div>
                )}
                <div style={departmentBadgeRowStyle}>
                  <span>{room.unreadCount} unread</span>
                  <span>{room.needsEditorReviewCount} editor inbox</span>
                </div>
              </article>
              </Link>
            ))}
          </div>
        </div>

        <aside style={sideStackStyle}>
        <MainEditorInboxPanel
          events={inboxEvents}
          onAskEditor={sendToManager}
          onResolved={refreshEditorInbox}
        />

        <div style={activityPanelStyle}>
          <div style={activityHeaderStyle}>
            <span>ROOM ACTIVITY</span>
            <button
              type="button"
              disabled={jobLoading !== null || recoveringJobs}
              onClick={recoverJobs}
              style={buttonStateStyle(jobRecoverStyle, jobLoading !== null || recoveringJobs, recoveringJobs)}
            >
              {recoveringJobs ? "CHECKING..." : "CHECK / RESUME"}
            </button>
          </div>
          <div style={activityListStyle}>
            {officeActivity.map((item) => (
              <div key={item.id} style={activityItemStyle}>
                <div style={activityMetaStyle}>
                  <span>{item.room}</span>
                  <span style={{
                    color:
                      item.tone === "failed"
                        ? "#ff6b6b"
                        : item.tone === "active"
                          ? "var(--accent)"
                          : "#4af0c4",
                  }}>
                    {item.meta}
                  </span>
                </div>
                <div style={activityTitleStyle}>{item.title}</div>
                {item.job &&
                  (item.job.status === "queued" || item.job.status === "running") && (
                    <button
                      type="button"
                      onClick={() => updateJobStatus(item.job.id, "cancel")}
                      disabled={jobLoading !== null}
                      style={buttonStateStyle(activityButtonStyle, jobLoading !== null)}
                    >
                      CANCEL
                    </button>
                  )}
                {item.job &&
                  (item.job.status === "failed" || item.job.status === "dead_letter") && (
                    <button
                      type="button"
                      onClick={() => updateJobStatus(item.job.id, "retry")}
                      disabled={jobLoading !== null}
                      style={buttonStateStyle(activityButtonStyle, jobLoading !== null)}
                    >
                      RETRY
                    </button>
                  )}
              </div>
            ))}
            {officeActivity.length === 0 && (
              <div style={emptyCoverageStyle}>No room activity yet</div>
            )}
          </div>
        </div>
        </aside>
      </section>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        marginBottom: 20,
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "10px 20px",
              background: "transparent",
              color: tab === t.key ? "var(--accent)" : "var(--muted)",
              border: "none",
              borderBottom: `2px solid ${tab === t.key ? "var(--accent)" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Chat tab */}
      {tab === "chat" && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          <div style={chatOfficeHeaderStyle}>
            <div>
              <div style={panelTitleStyle}>EDITOR CHAT OFFICE</div>
              <p style={chatOfficeCopyStyle}>
                Use this for recommendations and approvals. Agent progress stays in
                room activity so the conversation stays readable.
              </p>
            </div>
          </div>
          <div style={sessionBoundaryStyle}>
            <div style={sessionCellStyle}>
              <span>Current Session</span>
              {sessions.length > 0 ? (
                <select
                  value={activeSessionId}
                  onChange={(event) => setActiveSessionId(event.target.value)}
                  style={sessionSelectStyle}
                  aria-label="Main Editor chat session"
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{sessionsLoading ? "Loading..." : "No session loaded"}</strong>
              )}
            </div>
            <div style={sessionCellStyle}>
              <span>Memory</span>
              <strong>{activeSession?.memoryStatus ?? "Room context only"}</strong>
            </div>
            <div style={sessionCellStyle}>
              <span>Pinned Context</span>
              <strong>{activeSession?.pinnedContextStatus ?? "None pinned"}</strong>
            </div>
            <button
              type="button"
              disabled={sessionsLoading || !sessionsCanCreate}
              onClick={createEditorSession}
              style={buttonStateStyle(newSessionButtonStyle, sessionsLoading || !sessionsCanCreate, sessionsLoading)}
              title={
                sessionsCanCreate
                  ? "Create a new Main Editor session"
                  : sessionError ?? "Session schema is not ready yet"
              }
            >
              {sessionsLoading
                ? "SESSIONS..."
                : sessionsCanCreate
                  ? "NEW SESSION"
                  : "SESSION SCHEMA PENDING"}
            </button>
          </div>
          {sessionError && (
            <div style={sessionErrorStyle}>
              {sessionError}
            </div>
          )}
          {localNotices.length > 0 && (
            <div style={noticeStripStyle}>
              {localNotices.map((notice) => (
                <div key={notice.id} style={noticeItemStyle}>
                  <span style={{ color: noticeColor(notice.tone) }}>
                    {notice.tone.toUpperCase()}
                  </span>
                  <span>{notice.text}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalNotices((prev) =>
                        prev.filter((item) => item.id !== notice.id)
                      )
                    }
                    style={noticeCloseStyle}
                  >
                    CLOSE
                  </button>
                </div>
              ))}
            </div>
          )}
          {(activeJobs.length > 0 || failedJobs.length > 0) && (
            <div style={jobStripStyle}>
              <div style={jobStripHeaderStyle}>
                <span>ACTIVE AI TASKS</span>
                <button
                  type="button"
                  disabled={jobLoading !== null || recoveringJobs}
                  onClick={recoverJobs}
                  style={buttonStateStyle(jobRecoverStyle, jobLoading !== null || recoveringJobs, recoveringJobs)}
                >
                  {recoveringJobs ? "CHECKING..." : "CHECK / RESUME"}
                </button>
              </div>
              {[...activeJobs, ...failedJobs].slice(0, 5).map((job) => (
                <div key={job.id} style={jobRowStyle}>
                  <span>{job.title}</span>
                  <span style={jobRowActionsStyle}>
                    <span style={jobStatusStyle}>
                      {job.status.toUpperCase()}
                      {typeof job.retryCount === "number" &&
                        typeof job.maxRetries === "number" &&
                        job.status !== "queued" &&
                        ` ${job.retryCount}/${job.maxRetries}`}
                    </span>
                    {(job.status === "queued" || job.status === "running") && (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, "cancel")}
                        disabled={jobLoading !== null}
                        style={buttonStateStyle(smallGhostButtonStyle, jobLoading !== null)}
                      >
                        CANCEL
                      </button>
                    )}
                    {(job.status === "failed" || job.status === "dead_letter") && (
                      <button
                        type="button"
                        onClick={() => updateJobStatus(job.id, "retry")}
                        disabled={jobLoading !== null}
                        style={buttonStateStyle(smallGhostButtonStyle, jobLoading !== null)}
                      >
                        RETRY
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{
            height: 380,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {messagesError && (
              <div style={sessionErrorStyle}>{messagesError}</div>
            )}
            {messagesLoading && messages.length === 0 && (
              <div style={messageLoadingStyle}>
                Loading Main Editor session messages...
              </div>
            )}
            {!messagesLoading && messages.length === 0 && (
              <div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color: "var(--muted)",
                  marginBottom: 16,
                }}>
                  Ask the AI manager anything about your site:
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      style={{
                        padding: "8px 12px",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 10,
                        color: "var(--muted)",
                        cursor: "pointer",
                        textAlign: "left",
                        lineHeight: 1.4,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: m.role === "user"
                    ? "var(--accent)"
                    : "var(--surface2)",
                  border: m.role === "user"
                    ? "none"
                    : "1px solid var(--border)",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: m.role === "user" ? "#000" : "var(--text)",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
                {m.role === "assistant" &&
                  Array.isArray(m.metadata?.actionCards) &&
                  m.metadata.actionCards.length > 0 && (
                    <div style={actionCardWrapStyle}>
                      {uniqueActionCards(m.metadata.actionCards).map((card) => {
                        const key = `${card.jobType}:${card.label}`
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => previewJob(card)}
                            disabled={jobLoading !== null}
                            style={{
                              ...actionCardStyle,
                              opacity: jobLoading === key ? 0.6 : 1,
                              cursor: jobLoading ? "not-allowed" : "pointer",
                            }}
                          >
                            <span>{jobLoading === key ? "QUEUING..." : card.label}</span>
                            <span style={actionCardHintStyle}>
                              {jobLoading === key ? "PREVIEWING..." : card.confirmLabel}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
              </div>
            ))}

            {actionCards.length > 0 && (
              <div style={liveActionCardWrapStyle}>
                {uniqueActionCards(actionCards).map((card) => {
                  const key = `${card.jobType}:${card.label}`
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => previewJob(card)}
                      disabled={jobLoading !== null}
                      style={{
                        ...actionCardStyle,
                        opacity: jobLoading === key ? 0.6 : 1,
                        cursor: jobLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      <span>{jobLoading === key ? "QUEUING..." : card.label}</span>
                      <span style={actionCardHintStyle}>
                        {jobLoading === key ? "PREVIEWING..." : card.confirmLabel || "Preview task"}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {isThinking && (
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 0",
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: "1px",
                  marginTop: 2,
                  flexShrink: 0,
                }}>
                  MGR
                </div>
                <div style={{
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderLeft: "3px solid var(--accent)",
                  borderRadius: "0 6px 6px 6px",
                }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        display: "inline-block",
                        animation: "thinking-dot 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--muted)",
                    marginLeft: 6,
                    letterSpacing: "0.5px",
                  }}>
                    processing query...
                  </span>
                </div>
              </div>
            )}

            {streamingContent && (
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 0",
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: "1px",
                  marginTop: 2,
                  flexShrink: 0,
                }}>
                  MGR
                </div>
                <div style={{
                  padding: "10px 14px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderLeft: "3px solid var(--accent)",
                  borderRadius: "0 6px 6px 6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "var(--text)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}>
                  {streamingContent}
                  <span style={{
                    display: "inline-block",
                    width: 8,
                    height: 14,
                    background: "var(--accent)",
                    marginLeft: 2,
                    verticalAlign: "text-bottom",
                    animation: "cursor-blink 0.8s step-end infinite",
                  }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendToManager()}
              disabled={loading}
              placeholder="Ask the AI manager..."
              style={{
                flex: 1,
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                borderRadius: 4,
                padding: "10px 14px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: "var(--text)",
                outline: "none",
                opacity: loading ? 0.55 : 1,
                cursor: loading ? "not-allowed" : "text",
              }}
            />
            <button
              onClick={() => sendToManager()}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 20px",
                background: loading || !input.trim()
                  ? "transparent"
                  : "var(--accent)",
                color: loading || !input.trim() ? "var(--muted)" : "#000",
                border: `1px solid ${loading || !input.trim() ? "var(--border)" : "var(--accent)"}`,
                borderRadius: 4,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === "logs" && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "120px 120px 80px 80px 1fr",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}>
            <span>Action</span>
            <span>Model</span>
            <span>Time</span>
            <span>Tokens</span>
            <span>Status</span>
          </div>
          {logs.map((l) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 120px 80px 80px 1fr",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--accent)" }}>{l.action}</span>
              <span style={{ color: "var(--muted)" }}>{l.model}</span>
              <span style={{ color: "var(--muted)" }}>{l.ms}ms</span>
              <span style={{ color: "var(--muted)" }}>{l.tokens || "—"}</span>
              <span style={{ color: l.success ? "#4af0c4" : "#ff4d4d" }}>
                {l.success ? "✓" : `✗ ${l.error}`}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{
              padding: 32,
              textAlign: "center",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--muted)",
            }}>
              No AI actions logged yet
            </div>
          )}
        </div>
      )}

      {/* Digests tab */}
      {tab === "digests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {digests.map((d) => (
            <div
              key={d.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 20,
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: "var(--accent)",
                }}>
                  {d.date}
                </span>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--muted)",
                }}>
                  {d.model} · {new Date(d.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--muted)",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {d.content}
              </p>
            </div>
          ))}
          {digests.length === 0 && (
            <div style={{
              padding: 32,
              textAlign: "center",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--muted)",
            }}>
              No digests generated yet. Visit /digest to create one.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const commandLobbyStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(108,143,255,0.08), rgba(13,15,24,0))",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  marginBottom: 20,
}

const lobbyHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) minmax(260px, 0.55fr)",
  gap: 18,
  alignItems: "start",
  marginBottom: 16,
}

const sectionEyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.4px",
  textTransform: "uppercase",
  color: "var(--accent)",
  marginBottom: 8,
}

const sectionHeadingStyle: CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 24,
  lineHeight: 1.15,
  color: "var(--text)",
  margin: 0,
}

const sectionCopyStyle: CSSProperties = {
  maxWidth: 680,
  margin: "8px 0 0",
  color: "var(--muted)",
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 13,
  lineHeight: 1.6,
}

const lobbyStatusGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(80px, 1fr))",
  gap: 8,
}

const lobbyStatusCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 12,
  display: "grid",
  gap: 6,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
}

const modelsRailStyle: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
  padding: "10px 12px",
  marginBottom: 16,
  background: "rgba(0,0,0,0.16)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
}

const railLabelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "var(--muted)",
}

const modelPillWrapStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
}

const modelTaskStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
  textTransform: "uppercase",
}

const modelPillStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  background: "rgba(74,240,196,0.08)",
  padding: "2px 8px",
  borderRadius: 2,
  border: "1px solid rgba(74,240,196,0.15)",
}

const officeFloorStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(420px, 1fr) minmax(280px, 0.36fr)",
  gap: 16,
  marginBottom: 24,
}

const officeRoomsPanelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 16,
}

const departmentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
}

const departmentCardStyle: CSSProperties = {
  minHeight: 136,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 14,
  display: "grid",
  alignContent: "start",
  gap: 10,
}

const departmentCardLinkStyle: CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  display: "block",
}

const departmentHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.4px",
  textTransform: "uppercase",
}

const departmentStatusStyle: CSSProperties = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
}

const departmentCopyStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 12,
  lineHeight: 1.55,
}

const departmentStaffStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 8,
  letterSpacing: "0.7px",
  textTransform: "uppercase",
}

const departmentBadgeRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const sideStackStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  alignContent: "start",
}

const activityPanelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  overflow: "hidden",
}

const activityHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderBottom: "1px solid var(--border)",
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const activityListStyle: CSSProperties = {
  display: "grid",
  maxHeight: 430,
  overflowY: "auto",
}

const activityItemStyle: CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  display: "grid",
  gap: 7,
}

const activityMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.8px",
  textTransform: "uppercase",
}

const activityTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 12,
  lineHeight: 1.45,
}

const activityButtonStyle: CSSProperties = {
  padding: "4px 7px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
  justifySelf: "start",
}

const chatOfficeHeaderStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
  background: "rgba(255,255,255,0.025)",
}

const chatOfficeCopyStyle: CSSProperties = {
  margin: 0,
  color: "var(--muted)",
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 12,
  lineHeight: 1.5,
}

function noticeColor(tone: LocalNotice["tone"]) {
  if (tone === "bad") return "#ff6b6b"
  if (tone === "warn") return "#f5c542"
  return "var(--accent)"
}

function buttonStateStyle(base: CSSProperties, disabled: boolean, active = false): CSSProperties {
  return {
    ...base,
    opacity: disabled && !active ? 0.55 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  }
}

const sessionBoundaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
  background: "rgba(108,143,255,0.045)",
}

const sessionCellStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "9px 10px",
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 5,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
}

const sessionSelectStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "5px 6px",
}

const newSessionButtonStyle: CSSProperties = {
  minHeight: 48,
  padding: "8px 10px",
  background: "transparent",
  border: "1px dashed var(--border2)",
  borderRadius: 5,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "not-allowed",
}

const sessionErrorStyle: CSSProperties = {
  padding: "8px 16px",
  borderBottom: "1px solid var(--border)",
  color: "#f5c542",
  background: "rgba(245,197,66,0.07)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const messageLoadingStyle: CSSProperties = {
  padding: 14,
  color: "var(--muted)",
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const noticeStripStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "10px 16px",
  borderBottom: "1px solid var(--border)",
  background: "rgba(0,0,0,0.12)",
}

const noticeItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "52px minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  lineHeight: 1.4,
}

const noticeCloseStyle: CSSProperties = {
  padding: "3px 6px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 8,
  cursor: "pointer",
}

const actionCardWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
  maxWidth: "80%",
}

const liveActionCardWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 4,
  maxWidth: "80%",
}

const jobStripStyle: CSSProperties = {
  borderBottom: "1px solid var(--border)",
  background: "rgba(108,143,255,0.06)",
}

const jobStripHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const jobRecoverStyle: CSSProperties = {
  padding: "6px 9px",
  border: "1px solid rgba(108,143,255,0.28)",
  borderRadius: 4,
  color: "var(--accent)",
  background: "rgba(108,143,255,0.08)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
}

const jobRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 16px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
}

const jobStatusStyle: CSSProperties = {
  color: "var(--accent)",
  flexShrink: 0,
}

const jobRowActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
}

const actionCardStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "9px 11px",
  background: "rgba(108,143,255,0.08)",
  border: "1px solid rgba(108,143,255,0.22)",
  borderRadius: 5,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "left",
}

const actionCardHintStyle: CSSProperties = {
  color: "var(--accent)",
  fontSize: 9,
  letterSpacing: "0.7px",
  textTransform: "uppercase",
}

const controlPlaneGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 0.85fr) minmax(360px, 1.15fr)",
  gap: 16,
  marginBottom: 22,
}

const controlPanelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 16,
}

const panelTitleStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.2px",
  color: "var(--muted)",
  marginBottom: 12,
}

const quickActionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
}

const quickActionButtonStyle: CSSProperties = {
  ...actionCardStyle,
  minHeight: 62,
  cursor: "pointer",
}

const previewStyle: CSSProperties = {
  marginTop: 14,
  padding: 12,
  background: "rgba(74,240,196,0.06)",
  border: "1px solid rgba(74,240,196,0.18)",
  borderRadius: 5,
}

const previewHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  marginBottom: 10,
}

const previewMetricStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  lineHeight: 1.6,
}

const previewMetaStyle: CSSProperties = {
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  lineHeight: 1.6,
  marginTop: 6,
}

const previewWarningStyle: CSSProperties = {
  color: "#f5c542",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  lineHeight: 1.6,
  marginTop: 6,
}

const runPreviewButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "9px 10px",
  background: "var(--accent)",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  cursor: "pointer",
}

const smallGhostButtonStyle: CSSProperties = {
  padding: "4px 7px",
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  cursor: "pointer",
}

const coverageTableStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  overflowX: "auto",
}

const coverageHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr repeat(4, minmax(76px, 0.7fr))",
  gap: 8,
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.7px",
  textTransform: "uppercase",
  minWidth: 560,
}

const coverageRowStyle: CSSProperties = {
  ...coverageHeaderStyle,
  color: "var(--text)",
  textTransform: "none",
  letterSpacing: 0,
  fontSize: 10,
}

const emptyCoverageStyle: CSSProperties = {
  padding: 20,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textAlign: "center",
}

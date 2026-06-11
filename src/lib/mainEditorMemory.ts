import type { AdminAiJobStatus } from "@/lib/adminAiJobs"
import type { AdminDepartmentId } from "@/lib/adminDepartments"
import { getDepartmentSummaries } from "@/lib/adminDepartments"
import { prisma } from "@/lib/db"
import { getRagStatus } from "@/lib/rag"

export type MainEditorSessionScope =
  | "general"
  | "department"
  | "job"
  | "article"
  | "digest"
  | "publishing"

export type MainEditorSessionStatus = "active" | "archived"

export type MainEditorSessionDraft = {
  id?: string
  title: string
  scope: MainEditorSessionScope
  status: MainEditorSessionStatus
  department?: AdminDepartmentId | null
  jobId?: string | null
  articleId?: string | null
  createdAt?: string
  updatedAt?: string
  lastMessageAt?: string | null
}

export type MainEditorMemoryType =
  | "preference"
  | "policy"
  | "project_fact"
  | "source_rule"
  | "publishing_rule"
  | "workflow_rule"

export type MainEditorMemoryStatus = "active" | "superseded" | "archived"

export type MainEditorMemoryDraft = {
  id?: string
  type: MainEditorMemoryType
  key: string
  value: string
  confidence: number
  status: MainEditorMemoryStatus
  sourceMessageId?: string | null
  createdAt?: string
  updatedAt?: string
}

export type MainEditorActionType =
  | "create_job"
  | "publish"
  | "discard"
  | "reanalyse"
  | "resolve_event"
  | "open_room"
  | "update_memory"

export type MainEditorActionStatus =
  | "suggested"
  | "confirmed"
  | "executed"
  | "rejected"
  | "failed"

export type MainEditorActionDraft = {
  id?: string
  sessionId?: string | null
  departmentEventId?: string | null
  jobId?: string | null
  articleId?: string | null
  type: MainEditorActionType
  label: string
  payload: Record<string, unknown>
  status: MainEditorActionStatus
  createdAt?: string
  executedAt?: string | null
}

export type MainEditorAuditEventDraft = {
  id?: string
  actorType: "admin" | "ai" | "system" | string
  actorId?: string | null
  action: string
  targetType: "session" | "memory" | "message" | "job" | "article" | "department_event" | "digest"
  targetId?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  createdAt?: string
}

export type MainEditorChannelName =
  | "chat"
  | "room_activity"
  | "notification"
  | "audit_log"

export type MainEditorChannelBoundary = {
  channel: MainEditorChannelName
  belongsHere: string[]
  mustNotContain: string[]
}

export const MAIN_EDITOR_CHANNEL_BOUNDARIES: MainEditorChannelBoundary[] = [
  {
    channel: "chat",
    belongsHere: [
      "admin questions and decisions",
      "assistant recommendations",
      "executive job summaries",
      "confirmed action cards",
      "session-specific context discussion",
    ],
    mustNotContain: [
      "article-by-article job progress",
      "embedding chunk progress",
      "raw agent activity feed",
      "notification bell payloads copied verbatim",
    ],
  },
  {
    channel: "room_activity",
    belongsHere: [
      "department pipeline progress",
      "agent work notes",
      "job phase changes",
      "room-local warnings and results",
    ],
    mustNotContain: [
      "long-term editorial preferences",
      "private chat transcript",
      "confirmed audit history as the only source of truth",
    ],
  },
  {
    channel: "notification",
    belongsHere: [
      "interrupt-worthy completions",
      "failures",
      "items needing Main Editor review",
      "publish and unpublish status",
    ],
    mustNotContain: [
      "routine progress spam",
      "full AI responses",
      "memory facts",
    ],
  },
  {
    channel: "audit_log",
    belongsHere: [
      "admin-confirmed actions",
      "system-executed mutations",
      "before and after state for important operations",
      "AI-suggested actions and final disposition",
    ],
    mustNotContain: [
      "draft-only reasoning as operational proof",
      "raw room telemetry as a substitute for decisions",
      "ephemeral UI state",
    ],
  },
]

export const MAIN_EDITOR_PROPOSED_API_ROUTES = {
  sessions: "/api/admin/ai/editor/sessions",
  sessionMessages: "/api/admin/ai/editor/sessions/[sessionId]/messages",
  memory: "/api/admin/ai/editor/memory",
  context: "/api/admin/ai/editor/context",
  confirmAction: "/api/admin/ai/editor/actions/[actionId]/confirm",
  rejectAction: "/api/admin/ai/editor/actions/[actionId]/reject",
  audit: "/api/admin/ai/editor/audit",
  inbox: "/api/admin/ai/editor/inbox",
} as const

export type MainEditorContextPackRequest = {
  session?: MainEditorSessionDraft | null
  selectedDepartmentEventId?: string | null
  selectedJobId?: string | null
  selectedArticleId?: string | null
  includeRecentMessages?: number
  includeMemories?: MainEditorMemoryDraft[]
}

export type MainEditorContextPack = {
  session: MainEditorSessionDraft
  memory: MainEditorMemoryDraft[]
  selected: {
    departmentEvent: MainEditorContextDepartmentEvent | null
    job: MainEditorContextJob | null
    article: MainEditorContextArticle | null
  }
  departments: MainEditorContextDepartment[]
  activeJobs: MainEditorContextJob[]
  recentFailures: MainEditorContextJob[]
  pendingApprovals: MainEditorContextDepartmentEvent[]
  notifications: MainEditorContextNotification[]
  recentMessages: MainEditorContextMessage[]
  publicPublishing: {
    publishedAiReports: number
    pendingAiDrafts: number
    todaysDigestReady: boolean
    ragCoveragePercent: number
  }
  promptSections: {
    session: string
    memory: string
    operationalSnapshot: string
    selectedContext: string
    boundaries: string
  }
}

export type MainEditorContextDepartment = {
  id: string
  label: string
  unreadCount: number
  needsEditorReviewCount: number
  activeJobs: number
  failedJobs: number
}

export type MainEditorContextDepartmentEvent = {
  id: string
  department: string
  type: string
  title: string
  body: string
  severity: string
  status: string
  needsEditorReview: boolean
  jobId: string | null
  metadata: unknown
  createdAt: string
}

export type MainEditorContextJob = {
  id: string
  type: string
  title: string
  status: AdminAiJobStatus | string
  phase: string | null
  error: string | null
  retryCount: number
  maxRetries: number
  updatedAt: string
}

export type MainEditorContextArticle = {
  id: string
  title: string
  topic: string
  source: string
  aiGenerated: boolean
  published: boolean
  summary: string | null
  factScore: number | null
}

export type MainEditorContextNotification = {
  id: string
  type: string
  title: string
  body: string
  severity: string | null
  department: string | null
  jobId: string | null
  createdAt: string
}

export type MainEditorContextMessage = {
  id: string
  role: string
  content: string
  metadata: unknown
  jobId: string | null
  createdAt: string
}

export function createDefaultMainEditorSession(
  input: Partial<MainEditorSessionDraft> = {}
): MainEditorSessionDraft {
  return {
    title: input.title ?? "Main Editor Office",
    scope: input.scope ?? "general",
    status: input.status ?? "active",
    department: input.department ?? null,
    jobId: input.jobId ?? null,
    articleId: input.articleId ?? null,
  }
}

export function shouldShowManagerMessageInChat(message: {
  role: string
  jobId: string | null
  metadata: unknown
}) {
  if (message.jobId) return false
  if (message.role !== "user" && message.role !== "assistant") return false

  const metadata =
    message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
      ? (message.metadata as Record<string, unknown>)
      : {}
  const event = typeof metadata.event === "string" ? metadata.event.toLowerCase() : ""
  const source = typeof metadata.source === "string" ? metadata.source : ""
  const type = typeof metadata.type === "string" ? metadata.type : ""

  if (
    event.startsWith("job") ||
    event.startsWith("task") ||
    event.startsWith("system") ||
    source === "job" ||
    source === "department" ||
    source === "notification" ||
    source === "system" ||
    type === "job_failure"
  ) {
    return false
  }

  return true
}

export async function buildMainEditorContextPack(
  request: MainEditorContextPackRequest = {}
): Promise<MainEditorContextPack> {
  const session = request.session ?? createDefaultMainEditorSession()
  const today = new Date().toISOString().slice(0, 10)
  const messageTake = Math.min(Math.max(request.includeRecentMessages ?? 12, 0), 50)

  const [
    departments,
    activeJobs,
    recentFailures,
    pendingApprovals,
    notifications,
    recentMessagesRaw,
    selectedDepartmentEvent,
    selectedJob,
    selectedArticle,
    publishedAiReports,
    pendingAiDrafts,
    todaysDigest,
    ragStatus,
  ] = await Promise.all([
    getDepartmentSummaries(),
    prisma.adminAiJob.findMany({
      where: { status: { in: ["queued", "running"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.adminAiJob.findMany({
      where: { status: { in: ["failed", "dead_letter"] } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.adminDepartmentEvent.findMany({
      where: {
        needsEditorReview: true,
        status: { notIn: ["resolved", "archived"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.adminNotification.findMany({
      where: { status: "unread" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    messageTake > 0
      ? prisma.managerChatMessage.findMany({
          orderBy: { createdAt: "desc" },
          take: messageTake,
        })
      : Promise.resolve([]),
    request.selectedDepartmentEventId
      ? prisma.adminDepartmentEvent.findUnique({
          where: { id: request.selectedDepartmentEventId },
        })
      : Promise.resolve(null),
    request.selectedJobId
      ? prisma.adminAiJob.findUnique({ where: { id: request.selectedJobId } })
      : Promise.resolve(null),
    request.selectedArticleId
      ? prisma.newsArticle.findUnique({
          where: { id: request.selectedArticleId },
          select: {
            id: true,
            title: true,
            topic: true,
            source: true,
            aiGenerated: true,
            published: true,
            summary: true,
            factScore: true,
          },
        })
      : Promise.resolve(null),
    prisma.newsArticle.count({ where: { aiGenerated: true, published: true } }),
    prisma.newsArticle.count({ where: { aiGenerated: true, published: false } }),
    prisma.dailyDigest.findUnique({ where: { date: today } }),
    getRagStatus(),
  ])

  const recentMessages = recentMessagesRaw
    .filter(shouldShowManagerMessageInChat)
    .reverse()
    .map(toContextMessage)

  const pack: MainEditorContextPack = {
    session,
    memory: request.includeMemories ?? [],
    selected: {
      departmentEvent: selectedDepartmentEvent ? toContextDepartmentEvent(selectedDepartmentEvent) : null,
      job: selectedJob ? toContextJob(selectedJob) : null,
      article: selectedArticle,
    },
    departments: departments.map((department) => ({
      id: department.id,
      label: department.label,
      unreadCount: department.unreadCount,
      needsEditorReviewCount: department.needsEditorReviewCount,
      activeJobs: department.activeJobs,
      failedJobs: department.failedJobs,
    })),
    activeJobs: activeJobs.map(toContextJob),
    recentFailures: recentFailures.map(toContextJob),
    pendingApprovals: pendingApprovals.map(toContextDepartmentEvent),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      severity: notification.severity,
      department: notification.department,
      jobId: notification.jobId,
      createdAt: notification.createdAt.toISOString(),
    })),
    recentMessages,
    publicPublishing: {
      publishedAiReports,
      pendingAiDrafts,
      todaysDigestReady: Boolean(todaysDigest),
      ragCoveragePercent: ragStatus.coverage,
    },
    promptSections: {
      session: "",
      memory: "",
      operationalSnapshot: "",
      selectedContext: "",
      boundaries: "",
    },
  }

  pack.promptSections = buildPromptSections(pack)
  return pack
}

function toContextJob(job: {
  id: string
  type: string
  title: string
  status: string
  phase: string | null
  error: string | null
  retryCount: number
  maxRetries: number
  updatedAt: Date
}): MainEditorContextJob {
  return {
    id: job.id,
    type: job.type,
    title: job.title,
    status: job.status,
    phase: job.phase,
    error: job.error,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    updatedAt: job.updatedAt.toISOString(),
  }
}

function toContextDepartmentEvent(event: {
  id: string
  department: string
  type: string
  title: string
  body: string
  severity: string
  status: string
  needsEditorReview: boolean
  jobId: string | null
  metadata: unknown
  createdAt: Date
}): MainEditorContextDepartmentEvent {
  return {
    id: event.id,
    department: event.department,
    type: event.type,
    title: event.title,
    body: event.body,
    severity: event.severity,
    status: event.status,
    needsEditorReview: event.needsEditorReview,
    jobId: event.jobId,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  }
}

function toContextMessage(message: {
  id: string
  role: string
  content: string
  metadata: unknown
  jobId: string | null
  createdAt: Date
}): MainEditorContextMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    jobId: message.jobId,
    createdAt: message.createdAt.toISOString(),
  }
}

function buildPromptSections(pack: Omit<MainEditorContextPack, "promptSections">): MainEditorContextPack["promptSections"] {
  return {
    session: [
      `Session: ${pack.session.title}`,
      `Scope: ${pack.session.scope}`,
      pack.session.department ? `Department: ${pack.session.department}` : null,
      pack.session.jobId ? `Job: ${pack.session.jobId}` : null,
      pack.session.articleId ? `Article: ${pack.session.articleId}` : null,
    ].filter(Boolean).join("\n"),
    memory:
      pack.memory.length > 0
        ? pack.memory
            .filter((memory) => memory.status === "active")
            .map((memory) => `${memory.type}:${memory.key}=${memory.value}`)
            .join("\n")
        : "No durable Main Editor memories have been attached yet.",
    operationalSnapshot: [
      `Published AI reports: ${pack.publicPublishing.publishedAiReports}`,
      `Pending AI drafts: ${pack.publicPublishing.pendingAiDrafts}`,
      `Digest ready today: ${pack.publicPublishing.todaysDigestReady ? "yes" : "no"}`,
      `RAG coverage: ${pack.publicPublishing.ragCoveragePercent}%`,
      `Active jobs: ${pack.activeJobs.map((job) => `${job.title} (${job.status})`).join(", ") || "none"}`,
      `Recent failures: ${pack.recentFailures.map((job) => `${job.title} (${job.retryCount}/${job.maxRetries})`).join(", ") || "none"}`,
      `Pending editor approvals: ${pack.pendingApprovals.length}`,
    ].join("\n"),
    selectedContext: pack.selected.departmentEvent
      ? [
          `Selected event: ${pack.selected.departmentEvent.title}`,
          `Department: ${pack.selected.departmentEvent.department}`,
          `Severity: ${pack.selected.departmentEvent.severity}`,
          `Body: ${pack.selected.departmentEvent.body}`,
        ].join("\n")
      : "No selected department event.",
    boundaries: MAIN_EDITOR_CHANNEL_BOUNDARIES.map(
      (boundary) =>
        `${boundary.channel}: belongs here [${boundary.belongsHere.join("; ")}]; must not contain [${boundary.mustNotContain.join("; ")}]`
    ).join("\n"),
  }
}

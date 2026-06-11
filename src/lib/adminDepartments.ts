import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export const DEPARTMENTS = [
  {
    id: "assignment",
    label: "Assignment Desk",
    route: "/admin/ai-manager/assignment",
    agent: "Planning Editor",
    description: "Previews work, schedules cycles, and keeps the queue moving.",
    staff: [
      { name: "Planning Editor", role: "Chief assigner", focus: "Chooses the next newsroom cycle and checks workload." },
      { name: "Queue Coordinator", role: "Scheduler", focus: "Watches pending jobs, scheduled runs, and blocked batches." },
      { name: "Coverage Planner", role: "Gap spotter", focus: "Finds topics that need summaries, research, or publishing." },
    ],
  },
  {
    id: "reporting",
    label: "Reporting Room",
    route: "/admin/ai-manager/reporting",
    agent: "Scout Agents",
    description: "Turns article signals into newsroom draft candidates.",
    staff: [
      { name: "Scout Lead", role: "Story scout", focus: "Finds strong public newsroom candidates." },
      { name: "Topic Beat Agent", role: "Beat monitor", focus: "Groups story candidates by topic and source coverage." },
      { name: "Draft Builder", role: "Reporter", focus: "Turns selected signals into first newsroom drafts." },
    ],
  },
  {
    id: "verification",
    label: "Verification Room",
    route: "/admin/ai-manager/verification",
    agent: "Fact Checkers",
    description: "Reviews claims, confidence, failures, and suspicious drafts.",
    staff: [
      { name: "Fact Checker", role: "Verifier", focus: "Reviews low fact-score and incomplete AI drafts." },
      { name: "Source Auditor", role: "Source check", focus: "Flags weak sources, duplicates, and missing attribution." },
      { name: "Risk Editor", role: "Escalation", focus: "Sends risky items to the Main Editor inbox." },
    ],
  },
  {
    id: "copy_desk",
    label: "Copy Desk",
    route: "/admin/ai-manager/copy-desk",
    agent: "Editors",
    description: "Handles summaries, tags, sentiment, headlines, and polish.",
    staff: [
      { name: "Summary Editor", role: "Summaries", focus: "Clears missing article summaries." },
      { name: "Tag Editor", role: "Taxonomy", focus: "Maintains tags and topic polish." },
      { name: "Mood Editor", role: "Sentiment", focus: "Reviews sentiment and public tone labels." },
    ],
  },
  {
    id: "research",
    label: "Research Library",
    route: "/admin/ai-manager/research",
    agent: "RAG Librarian",
    description: "Tracks embeddings, retrieval coverage, and knowledge gaps.",
    staff: [
      { name: "RAG Librarian", role: "Index lead", focus: "Tracks embeddings and retrieval coverage." },
      { name: "Archive Clerk", role: "Backfill", focus: "Finds missing and stale article embeddings." },
      { name: "Query Tester", role: "Retrieval QA", focus: "Tests whether the knowledge base answers clearly." },
    ],
  },
  {
    id: "digest",
    label: "Digest Room",
    route: "/admin/ai-manager/digest",
    agent: "Briefing Editor",
    description: "Builds daily briefings and public digest outputs.",
    staff: [
      { name: "Briefing Editor", role: "Digest lead", focus: "Prepares the daily public briefing." },
      { name: "Selection Editor", role: "Article picker", focus: "Checks included stories and balance." },
      { name: "Visibility Clerk", role: "Public status", focus: "Confirms the digest is safe to show publicly." },
    ],
  },
  {
    id: "publishing",
    label: "Publishing Desk",
    route: "/admin/ai-manager/publishing",
    agent: "Release Editor",
    description: "Approves drafts and controls public newsroom visibility.",
    staff: [
      { name: "Release Editor", role: "Publisher", focus: "Publishes, unpublishes, and discards newsroom reports." },
      { name: "Final Approval Clerk", role: "Approval queue", focus: "Tracks drafts sent from other rooms." },
      { name: "Public Desk", role: "Visibility", focus: "Checks what appears on /ai-news." },
    ],
  },
  {
    id: "operations",
    label: "Operations Room",
    route: "/admin/ai-manager/operations",
    agent: "Systems Operator",
    description: "Monitors jobs, retries, stale work, models, and system health.",
    staff: [
      { name: "Systems Operator", role: "Run desk", focus: "Monitors active, stalled, and failed jobs." },
      { name: "Retry Controller", role: "Recovery", focus: "Handles retries, cancellations, and dead letters." },
      { name: "Model Watch", role: "Health", focus: "Checks Ollama, APIs, and database readiness." },
    ],
  },
] as const

export type AdminDepartmentId = (typeof DEPARTMENTS)[number]["id"]
export type DepartmentEventSeverity = "info" | "success" | "warning" | "error"
export type DepartmentEventType =
  | "activity"
  | "notification"
  | "warning"
  | "failure"
  | "result"
  | "editor_escalation"
export type DepartmentEventSourceType =
  | "job"
  | "agent"
  | "ai_log"
  | "notification"
  | "manual"
  | "admin_action"

export type DepartmentEventMetadata = Record<string, unknown> & {
  event?: string
  action?: string
  targetType?: "article" | "job" | "rag_query" | "digest" | "department"
  articleId?: string
  jobType?: string
  status?: string
  phase?: string | null
}

const DEPARTMENT_BY_ROUTE = new Map(
  DEPARTMENTS.map((department) => [
    department.route.split("/").at(-1) ?? department.id,
    department,
  ])
)

export function isAdminDepartmentId(value: string): value is AdminDepartmentId {
  return DEPARTMENTS.some((department) => department.id === value)
}

export function normalizeDepartmentSlug(value: string): AdminDepartmentId | null {
  if (value === "copy-desk") return "copy_desk"
  if (isAdminDepartmentId(value)) return value
  const routeMatch = DEPARTMENT_BY_ROUTE.get(value)
  return routeMatch?.id ?? null
}

export function getDepartment(value: string) {
  const id = normalizeDepartmentSlug(value)
  return id ? DEPARTMENTS.find((department) => department.id === id) ?? null : null
}

export function departmentForJobType(type: string): AdminDepartmentId {
  if (type === "newsroom_cycle") return "reporting"
  if (type === "rag_reindex") return "research"
  if (type === "digest_generate") return "digest"
  if (type === "ai_batch") return "copy_desk"
  return "operations"
}

export function departmentForAiAction(action: string): AdminDepartmentId {
  if (action.includes("rag") || action.includes("embed")) return "research"
  if (action.includes("digest")) return "digest"
  if (action.includes("scout")) return "reporting"
  if (action.includes("fact") || action.includes("spin")) return "verification"
  if (action.includes("summary") || action.includes("tag") || action.includes("sentiment")) {
    return "copy_desk"
  }
  return "operations"
}

function toJsonObject(value?: Record<string, unknown>): Prisma.InputJsonObject | undefined {
  return value ? (value as Prisma.InputJsonObject) : undefined
}

function compactMetadata(metadata?: DepartmentEventMetadata) {
  if (!metadata) return undefined

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  ) as Record<string, unknown>
}

export async function createDepartmentEvent({
  department,
  type,
  title,
  body,
  severity = "info",
  status = "unread",
  needsEditorReview = false,
  jobId,
  sourceType = "manual",
  metadata,
  notify = false,
}: {
  department: AdminDepartmentId
  type: DepartmentEventType
  title: string
  body: string
  severity?: DepartmentEventSeverity
  status?: "unread" | "read" | "resolved" | "archived"
  needsEditorReview?: boolean
  jobId?: string
  sourceType?: DepartmentEventSourceType
  metadata?: DepartmentEventMetadata
  notify?: boolean
}) {
  const event = await prisma.adminDepartmentEvent.create({
    data: {
      department,
      type,
      title,
      body,
      severity,
      status,
      needsEditorReview,
      jobId,
      sourceType,
      metadata: toJsonObject(compactMetadata(metadata)),
    },
  })

  if (notify || severity === "error" || needsEditorReview) {
    await prisma.adminNotification.create({
      data: {
        type,
        title,
        body,
        status: "unread",
        jobId,
        department,
        severity,
        departmentEventId: event.id,
      },
    })
  }

  return event
}

export async function createAdminActionEvent({
  department,
  action,
  title,
  body,
  severity = "info",
  status = "unread",
  needsEditorReview = false,
  articleId,
  jobId,
  metadata,
  notify = true,
}: {
  department: AdminDepartmentId
  action: string
  title: string
  body: string
  severity?: DepartmentEventSeverity
  status?: "unread" | "read" | "resolved" | "archived"
  needsEditorReview?: boolean
  articleId?: string
  jobId?: string
  metadata?: DepartmentEventMetadata
  notify?: boolean
}) {
  return createDepartmentEvent({
    department,
    type:
      severity === "error"
        ? "failure"
        : severity === "success"
          ? "result"
          : severity === "warning"
            ? "warning"
            : "activity",
    title,
    body,
    severity,
    status,
    needsEditorReview,
    jobId,
    sourceType: "admin_action",
    metadata: {
      event: `admin_action.${action}`,
      action,
      targetType: articleId ? "article" : metadata?.targetType,
      articleId,
      ...metadata,
    },
    notify,
  })
}

export async function getDepartmentSummaries() {
  return Promise.all(
    DEPARTMENTS.map(async (department) => {
      const [unreadCount, needsEditorReviewCount, activeJobs, failedJobs, latestEvents] =
        await Promise.all([
          prisma.adminDepartmentEvent.count({
            where: { department: department.id, status: "unread" },
          }),
          prisma.adminDepartmentEvent.count({
            where: {
              department: department.id,
              needsEditorReview: true,
              status: { notIn: ["resolved", "archived"] },
            },
          }),
          prisma.adminAiJob.count({
            where: {
              type: { in: jobTypesForDepartment(department.id) },
              status: { in: ["queued", "running"] },
            },
          }),
          prisma.adminAiJob.count({
            where: {
              type: { in: jobTypesForDepartment(department.id) },
              status: { in: ["failed", "dead_letter"] },
            },
          }),
          prisma.adminDepartmentEvent.findMany({
            where: { department: department.id },
            orderBy: { createdAt: "desc" },
            take: 4,
          }),
        ])

      return {
        ...department,
        unreadCount,
        needsEditorReviewCount,
        activeJobs,
        failedJobs,
        latestEvents,
      }
    })
  )
}

export function jobTypesForDepartment(department: AdminDepartmentId) {
  if (department === "reporting" || department === "verification") return ["newsroom_cycle"]
  if (department === "copy_desk") return ["ai_batch"]
  if (department === "research") return ["rag_reindex"]
  if (department === "digest") return ["digest_generate"]
  if (department === "operations") {
    return ["newsroom_cycle", "rag_reindex", "ai_batch", "digest_generate"]
  }
  return ["newsroom_cycle", "rag_reindex", "ai_batch", "digest_generate"]
}

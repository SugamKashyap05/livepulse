import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

const LEGACY_SESSION_ID = "legacy-main-editor"
const MIGRATION_BLOCKER =
  "EditorSession migration is not applied to this database yet. Apply prisma/migrations/20260611143000_main_editor_sessions_audit_history and regenerate Prisma if needed."

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isJobOrSystemMetadata(metadata: unknown) {
  const record = asRecord(metadata)
  const event = typeof record.event === "string" ? record.event : ""
  const source = typeof record.source === "string" ? record.source : ""
  const type = typeof record.type === "string" ? record.type : ""

  return (
    event.startsWith("job_") ||
    event.startsWith("job.") ||
    event.startsWith("task") ||
    event.startsWith("system") ||
    source === "job" ||
    source === "department" ||
    source === "notification" ||
    source === "system" ||
    type === "job_failure"
  )
}

async function legacyResponse() {
    const rows = await prisma.managerChatMessage.findMany({
      where: { jobId: null },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
    })
    const visibleRows = rows.filter((row) => !isJobOrSystemMetadata(row.metadata))
    const latest = visibleRows[0]?.createdAt ?? null

    return NextResponse.json({
      schemaReady: false,
      canCreate: false,
      reason: MIGRATION_BLOCKER,
      activeSessionId: LEGACY_SESSION_ID,
      sessions: [
        {
          id: LEGACY_SESSION_ID,
          title: "Main Editor Legacy Session",
          status: "active",
          memoryStatus: "Using filtered legacy ManagerChatMessage history",
          pinnedContextStatus: "Not available until session schema lands",
          messageCount: visibleRows.length,
          updatedAt: latest?.toISOString() ?? null,
        },
      ],
    })
}

function isMissingEditorSchema(error: unknown) {
  const record = asRecord(error)
  const code = record.code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("EditorSession") ||
    message.includes("EditorMessage") ||
    message.includes("EditorContextRef")
  )
}

function memoryStatus(metadata: unknown) {
  const record = asRecord(metadata)
  const summary = typeof record.memorySummary === "string" ? record.memorySummary : ""
  const messageCount =
    typeof record.memoryMessageCount === "number" ? record.memoryMessageCount : 0
  return summary
    ? `Summary from ${messageCount} messages`
    : "No extracted memory summary yet"
}

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sessions = await prisma.editorSession.findMany({
      where: { status: "active" },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        metadata: true,
        updatedAt: true,
        lastMessageAt: true,
        _count: {
          select: {
            messages: true,
            contextRefs: true,
          },
        },
      },
    })

    if (sessions.length === 0) {
      const created = await prisma.editorSession.create({
        data: {
          title: "Main Editor Office",
          scope: "general",
          status: "active",
          metadata: {
            memorySummary: null,
            memoryMessageCount: 0,
          } as Prisma.InputJsonObject,
        },
        select: {
          id: true,
          title: true,
          status: true,
          metadata: true,
          updatedAt: true,
          lastMessageAt: true,
          _count: {
            select: {
              messages: true,
              contextRefs: true,
            },
          },
        },
      })
      sessions.push(created)
    }

    return NextResponse.json({
      schemaReady: true,
      canCreate: true,
      activeSessionId: sessions[0]?.id ?? null,
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        status: session.status,
        memoryStatus: memoryStatus(session.metadata),
        pinnedContextStatus:
          session._count.contextRefs > 0
            ? `${session._count.contextRefs} pinned context refs`
            : "No pinned context refs",
        messageCount: session._count.messages,
        updatedAt: (session.lastMessageAt ?? session.updatedAt).toISOString(),
      })),
    })
  } catch (error) {
    if (isMissingEditorSchema(error)) return legacyResponse()
    console.error("[api/admin/ai/editor/sessions] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : `Main Editor Session ${new Date().toLocaleDateString("en-US")}`
    const session = await prisma.editorSession.create({
      data: {
        title,
        scope: "general",
        status: "active",
        metadata: {
          memorySummary: null,
          memoryMessageCount: 0,
        } as Prisma.InputJsonObject,
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      schemaReady: true,
      canCreate: true,
      activeSessionId: session.id,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        memoryStatus: "No extracted memory summary yet",
        pinnedContextStatus: "No pinned context refs",
        messageCount: 0,
        updatedAt: session.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isMissingEditorSchema(error)) {
      return NextResponse.json(
        {
          error: MIGRATION_BLOCKER,
          canCreate: false,
          schemaReady: false,
          activeSessionId: LEGACY_SESSION_ID,
        },
        { status: 409 }
      )
    }
    console.error("[api/admin/ai/editor/sessions] create error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

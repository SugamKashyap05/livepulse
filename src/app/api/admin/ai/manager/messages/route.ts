import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

const LEGACY_SESSION_ID = "legacy-main-editor"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isJobOrSystemMetadata(metadata: Record<string, unknown>) {
  const event = typeof metadata.event === "string" ? metadata.event : ""
  const source = typeof metadata.source === "string" ? metadata.source : ""
  const type = typeof metadata.type === "string" ? metadata.type : ""

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

function isChatVisibleMessage(message: {
  role: string
  jobId: string | null
  metadata: unknown
}) {
  if (message.jobId) return false

  const metadata = asRecord(message.metadata)
  if (isJobOrSystemMetadata(metadata)) return false

  return message.role === "user" || message.role === "assistant"
}

function isMissingEditorSchema(error: unknown) {
  const record = asRecord(error)
  const code = record.code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("EditorSession") ||
    message.includes("EditorMessage")
  )
}

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const after = searchParams.get("after")
    const sessionId = searchParams.get("sessionId") || LEGACY_SESSION_ID
    const afterDate = after ? new Date(after) : null

    if (sessionId !== LEGACY_SESSION_ID) {
      try {
        const rawEditorMessages = await prisma.editorMessage.findMany({
          where: {
            sessionId,
            ...(afterDate && !Number.isNaN(afterDate.getTime())
              ? { createdAt: { gt: afterDate } }
              : {}),
          },
          orderBy: { createdAt: "asc" },
          take: afterDate ? 10 : 50,
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            jobId: true,
            createdAt: true,
          },
        })
        return NextResponse.json({
          messages: rawEditorMessages.filter(isChatVisibleMessage),
          sessionId,
          schemaReady: true,
        })
      } catch (error) {
        if (!isMissingEditorSchema(error)) throw error
      }
    }

    const rawMessages = await prisma.managerChatMessage.findMany({
      where: afterDate && !Number.isNaN(afterDate.getTime())
        ? { createdAt: { gt: afterDate } }
        : undefined,
      orderBy: { createdAt: "asc" },
      take: afterDate ? 10 : 50,
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        jobId: true,
        createdAt: true,
      },
    })
    const messages = rawMessages.filter((message) => {
      if (!isChatVisibleMessage(message)) return false
      if (sessionId === LEGACY_SESSION_ID) return true
      return asRecord(message.metadata).sessionId === sessionId
    })
    return NextResponse.json({
      messages,
      sessionId,
      schemaReady: false,
      reason:
        sessionId === LEGACY_SESSION_ID
          ? "Using filtered legacy ManagerChatMessage history."
          : "EditorMessage migration is not applied; falling back to filtered legacy chat history.",
    })
  } catch (error) {
    console.error("[api/admin/ai/manager/messages] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

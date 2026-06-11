import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

type AdminAuditInput = {
  actorType?: string
  actorId?: string | null
  action: string
  targetType: string
  targetId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

function serializeJson(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {})
}

function isMissingAuditTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("AdminAuditLog") ||
    message.includes("relation") ||
    message.includes("does not exist")
  )
}

export async function recordAdminAuditLog({
  actorType = "admin",
  actorId = null,
  action,
  targetType,
  targetId,
  before,
  after,
  metadata,
}: AdminAuditInput) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "AdminAuditLog" (
        "id",
        "actorType",
        "actorId",
        "action",
        "targetType",
        "targetId",
        "before",
        "after",
        "metadata",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${actorType},
        ${actorId},
        ${action},
        ${targetType},
        ${targetId},
        ${serializeJson(before)}::jsonb,
        ${serializeJson(after)}::jsonb,
        ${serializeJson(metadata)}::jsonb,
        CURRENT_TIMESTAMP
      )
    `
  } catch (error) {
    if (isMissingAuditTable(error)) {
      console.warn(
        "[adminAudit] AdminAuditLog table unavailable; audit entry was not persisted."
      )
      return
    }
    throw error
  }
}

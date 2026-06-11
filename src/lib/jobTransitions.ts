import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

type JobTransitionInput = {
  jobId: string
  fromStatus?: string | null
  toStatus: string
  event: string
  actorType?: string
  actorId?: string | null
  metadata?: Record<string, unknown>
}

function serializeJson(value: Record<string, unknown> | undefined) {
  return JSON.stringify(value ?? {})
}

function isMissingTransitionTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("JobStateTransition") ||
    message.includes("relation") ||
    message.includes("does not exist")
  )
}

export async function recordJobStateTransition({
  jobId,
  fromStatus = null,
  toStatus,
  event,
  actorType = "system",
  actorId = null,
  metadata,
}: JobTransitionInput) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "JobStateTransition" (
        "id",
        "jobId",
        "fromStatus",
        "toStatus",
        "event",
        "actorType",
        "actorId",
        "metadata",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${jobId},
        ${fromStatus},
        ${toStatus},
        ${event},
        ${actorType},
        ${actorId},
        ${serializeJson(metadata)}::jsonb,
        CURRENT_TIMESTAMP
      )
    `
  } catch (error) {
    if (isMissingTransitionTable(error)) {
      console.warn(
        "[jobTransitions] JobStateTransition table unavailable; transition was not persisted."
      )
      return
    }
    throw error
  }
}

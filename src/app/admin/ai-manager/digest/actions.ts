"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { createAdminActionEvent } from "@/lib/adminDepartments"

export async function queueDigestGeneration() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "digest_generate",
      status: "queued",
      title: "Generate digest",
      params: { regen: false },
      maxRetries: 3,
    },
  })

  revalidatePath("/admin/ai-manager/digest")
}

export async function queueDigestRegeneration(digestId?: string | null) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "digest_generate",
      status: "queued",
      title: "Regenerate digest",
      params: { regen: true, digestId },
      maxRetries: 3,
    },
  })

  revalidatePath("/admin/ai-manager/digest")
}

export async function generateDailyDigest() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "digest_generate",
      status: "queued",
      title: "Generate daily digest",
      params: { regen: false },
      maxRetries: 3,
    },
  })
  revalidatePath("/admin/ai-manager/digest")
}

export async function regenerateDigest(id: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "digest_generate",
      status: "queued",
      title: "Regenerate digest",
      params: { regen: true, digestId: id },
      maxRetries: 3,
    },
  })
  revalidatePath("/admin/ai-manager/digest")
}

export async function updateDigestContent(id: string, content: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.dailyDigest.update({
    where: { id },
    data: { content }
  })
  
  await createAdminActionEvent({
    department: "digest",
    action: "update_digest",
    title: `Digest updated manually`,
    body: `Digest ID: ${id}`,
    severity: "info",
    metadata: { targetType: "digest", id }
  })

  revalidatePath("/admin/ai-manager/digest")
}

export async function publishDigest(id: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  // Resolve any pending inbox drafts for digest
  await prisma.adminDepartmentEvent.updateMany({
    where: { department: "digest", status: "unread" },
    data: { status: "resolved", resolvedAt: new Date(), readAt: new Date() }
  })

  await createAdminActionEvent({
    department: "digest",
    action: "publish_digest",
    title: `Digest published`,
    body: `Digest ID: ${id} has been published to users`,
    severity: "success",
    metadata: { targetType: "digest", id }
  })

  revalidatePath("/admin/ai-manager/digest")
}

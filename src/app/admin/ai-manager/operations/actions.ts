"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { createAdminActionEvent } from "@/lib/adminDepartments"
import { recordAdminAuditLog } from "@/lib/adminAudit"

export async function cancelAllPendingJobs() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const count = await prisma.adminAiJob.count({
    where: { status: { in: ["queued", "running"] } },
  })

  await prisma.adminAiJob.updateMany({
    where: { status: { in: ["queued", "running"] } },
    data: { status: "cancelled", error: "Cancelled by admin bulk action" }
  })

  await recordAdminAuditLog({
    action: "cancel_all_pending_jobs",
    targetType: "job",
    targetId: "bulk",
    after: { status: "cancelled", count },
    metadata: { department: "operations" },
  })

  await createAdminActionEvent({
    department: "operations",
    action: "cancel_all_pending_jobs",
    title: `Cancelled ${count} pending jobs`,
    body: "Bulk cancel executed",
    severity: "warning",
    metadata: { targetType: "job", count }
  })

  revalidatePath("/admin/ai-manager/operations")
}

export async function retryAllFailedJobs() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const count = await prisma.adminAiJob.count({
    where: { status: { in: ["failed", "dead_letter"] } },
  })

  await prisma.adminAiJob.updateMany({
    where: { status: { in: ["failed", "dead_letter"] } },
    data: { status: "queued", error: null, retryCount: 0 }
  })

  await recordAdminAuditLog({
    action: "retry_all_failed_jobs",
    targetType: "job",
    targetId: "bulk",
    after: { status: "queued", count },
    metadata: { department: "operations" },
  })

  await createAdminActionEvent({
    department: "operations",
    action: "retry_all_failed_jobs",
    title: `Retrying ${count} failed jobs`,
    body: "Bulk retry executed",
    severity: "info",
    metadata: { targetType: "job", count }
  })

  revalidatePath("/admin/ai-manager/operations")
}

export async function purgeOldJobs() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const count = await prisma.adminAiJob.count({
    where: {
      status: { in: ["completed", "cancelled", "failed", "dead_letter"] },
      createdAt: { lt: sevenDaysAgo }
    }
  })

  await prisma.adminAiJob.deleteMany({
    where: {
      status: { in: ["completed", "cancelled", "failed", "dead_letter"] },
      createdAt: { lt: sevenDaysAgo }
    }
  })

  await recordAdminAuditLog({
    action: "purge_old_jobs",
    targetType: "job",
    targetId: "bulk",
    before: { count },
    metadata: { department: "operations" },
  })

  await createAdminActionEvent({
    department: "operations",
    action: "purge_old_jobs",
    title: `Purged ${count} old jobs`,
    body: "Bulk purge executed",
    severity: "info",
    metadata: { targetType: "job", count }
  })

  revalidatePath("/admin/ai-manager/operations")
}

export async function runMigrations() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "run_migrations",
      status: "queued",
      title: "Run database migrations",
      params: {},
    },
  })

  await createAdminActionEvent({
    department: "operations",
    action: "run_migrations",
    title: `Database Migrations Queued`,
    body: "Migration job has been queued.",
    severity: "info",
    metadata: { targetType: "job" }
  })

  revalidatePath("/admin/ai-manager/operations")
}

export async function queueReindexAll() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "reindex_all",
      status: "queued",
      title: "Reindex all articles",
      params: {},
    },
  })

  await createAdminActionEvent({
    department: "operations",
    action: "queue_reindex_all",
    title: `Full Reindex Queued`,
    body: "Reindex job has been queued.",
    severity: "info",
    metadata: { targetType: "job" }
  })

  revalidatePath("/admin/ai-manager/operations")
}

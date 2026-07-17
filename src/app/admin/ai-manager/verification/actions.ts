"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { createAdminActionEvent } from "@/lib/adminDepartments"

export async function queueVerificationCycle() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "newsroom_cycle",
      status: "queued",
      title: "Run verification cycle",
      params: {},
    },
  })

  revalidatePath("/admin/ai-manager/verification")
}

export async function queueReanalyseDrafts() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "newsroom_cycle",
      status: "queued",
      title: "Reanalyse drafts",
      params: {},
    },
  })

  revalidatePath("/admin/ai-manager/verification")
}

export async function dismissAllWarnings() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  // Find unread department events for verification and resolve them
  await prisma.adminDepartmentEvent.updateMany({
    where: { department: "verification", status: { not: "resolved" } },
    data: { status: "resolved", resolvedAt: new Date(), readAt: new Date() }
  })

  revalidatePath("/admin/ai-manager/verification")
}

export async function runVerification() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "verify_articles",
      status: "queued",
      title: "Run verification cycle",
      params: {},
    },
  })

  revalidatePath("/admin/ai-manager/verification")
}

export async function overrideFactScore(id: string, score: number, reason: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.newsArticle.update({
    where: { id },
    data: { factScore: score, factScoreOverrideReason: reason }
  })

  await createAdminActionEvent({
    department: "verification",
    action: "override_fact_score",
    title: `Fact score overridden to ${score}`,
    body: `Article ID: ${id}\nReason: ${reason}`,
    severity: "warning",
    articleId: id,
    metadata: { targetType: "article", score, reason }
  })

  revalidatePath("/admin/ai-manager/verification")
}

export async function escalateArticle(id: string, reason: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await createAdminActionEvent({
    department: "verification",
    action: "escalate_article",
    title: "Article Escalated for Review",
    body: `Article ID: ${id}\nReason: ${reason}`,
    severity: "error",
    needsEditorReview: true,
    articleId: id,
    metadata: { targetType: "article", reason }
  })

  revalidatePath("/admin/ai-manager/verification")
}

"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { recordAdminAuditLog } from "@/lib/adminAudit"
import { createAdminActionEvent } from "@/lib/adminDepartments"

export async function publishAllApproved() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const drafts = await prisma.newsArticle.findMany({
    where: { published: false, summary: { not: null }, aiTags: { not: null }, sentiment: { not: null } },
  })

  if (drafts.length === 0) return 0

  await prisma.newsArticle.updateMany({
    where: { id: { in: drafts.map(d => d.id) } },
    data: { published: true }
  })

  await recordAdminAuditLog({
    action: "publish_all",
    targetType: "article_batch",
    targetId: "bulk",
    before: { count: drafts.length },
    after: { published: true },
    metadata: { department: "publishing-desk" },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "publish_all",
    title: `Published ${drafts.length} approved articles globally`,
    body: "Bulk publish executed",
    severity: "success",
    metadata: { count: drafts.length }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
  return drafts.length
}

export async function publishTopic(topic: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const drafts = await prisma.newsArticle.findMany({
    where: { published: false, topic, summary: { not: null }, aiTags: { not: null }, sentiment: { not: null } },
  })

  if (drafts.length === 0) return 0

  await prisma.newsArticle.updateMany({
    where: { id: { in: drafts.map(d => d.id) } },
    data: { published: true }
  })

  await recordAdminAuditLog({
    action: "publish_topic",
    targetType: "article_batch",
    targetId: topic,
    before: { count: drafts.length },
    after: { published: true },
    metadata: { department: "publishing-desk", topic },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "publish_topic",
    title: `Published ${drafts.length} approved articles in ${topic}`,
    body: "Bulk publish executed",
    severity: "success",
    metadata: { count: drafts.length, topic }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
  return drafts.length
}

export async function publishSingle(id: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const article = await prisma.newsArticle.findUnique({ where: { id } })
  if (!article) throw new Error("Article not found")

  const updated = await prisma.newsArticle.update({
    where: { id },
    data: { published: true }
  })

  await recordAdminAuditLog({
    action: "publish",
    targetType: "article",
    targetId: article.id,
    before: article,
    after: updated,
    metadata: { department: "publishing-desk" },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "publish",
    title: "Article published",
    body: article.title,
    severity: "success",
    articleId: article.id,
    metadata: { targetType: "article", topic: article.topic }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
}

export async function approveArticle(id: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const updated = await prisma.newsArticle.update({
    where: { id },
    data: { published: true, rejected: false, rejectionReason: null }
  })

  await recordAdminAuditLog({
    action: "approve_article",
    targetType: "article",
    targetId: id,
    after: updated,
    metadata: { department: "publishing-desk" },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "approve_article",
    title: "Article Approved",
    body: updated.title,
    severity: "success",
    articleId: id,
    metadata: { targetType: "article" }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
}

export async function rejectArticle(id: string, reason: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const updated = await prisma.newsArticle.update({
    where: { id },
    data: { published: false, rejected: true, rejectionReason: reason }
  })

  await recordAdminAuditLog({
    action: "reject_article",
    targetType: "article",
    targetId: id,
    after: updated,
    metadata: { department: "publishing-desk", reason },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "reject_article",
    title: "Article Rejected",
    body: `Rejected: ${updated.title}\nReason: ${reason}`,
    severity: "warning",
    articleId: id,
    metadata: { targetType: "article", reason }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
}

export async function bulkApproveAll() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const drafts = await prisma.newsArticle.findMany({
    where: { published: false, rejected: false, summary: { not: null }, aiTags: { not: null }, sentiment: { not: null } },
  })

  if (drafts.length === 0) return 0

  await prisma.newsArticle.updateMany({
    where: { id: { in: drafts.map(d => d.id) } },
    data: { published: true }
  })

  await recordAdminAuditLog({
    action: "bulk_approve_all",
    targetType: "article_batch",
    targetId: "bulk",
    before: { count: drafts.length },
    after: { published: true },
    metadata: { department: "publishing-desk" },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "bulk_approve_all",
    title: `Approved ${drafts.length} articles`,
    body: "Bulk approve executed",
    severity: "success",
    metadata: { count: drafts.length }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
  return drafts.length
}

export async function setArticleVisibility(id: string, visible: boolean) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const updated = await prisma.newsArticle.update({
    where: { id },
    data: { visible }
  })

  await recordAdminAuditLog({
    action: "set_article_visibility",
    targetType: "article",
    targetId: id,
    after: { visible },
    metadata: { department: "publishing-desk" },
  })

  await createAdminActionEvent({
    department: "publishing",
    action: "set_article_visibility",
    title: `Article visibility set to ${visible}`,
    body: updated.title,
    severity: "info",
    articleId: id,
    metadata: { targetType: "article", visible }
  })

  revalidatePath("/admin/ai-manager/publishing-desk")
}

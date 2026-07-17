"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function triggerManualSync() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "MANUAL_RSS_SYNC",
      status: "queued",
      title: "Manual RSS Sync",
      params: { department: "fetch-news" },
    },
  })

  await prisma.adminDepartmentEvent.create({
    data: {
      department: "fetch_news", // Usually fetch_news in DEPARTMENTS
      type: "MANUAL_SYNC_TRIGGERED",
      title: "Manual Sync Queued",
      body: "Manual RSS sync queued by admin",
      status: "unread",
    },
  })

  revalidatePath("/admin/ai-manager/fetch-news")
}

export async function retrySource(sourceId: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.feedSource.update({
    where: { id: sourceId },
    data: { lastStatus: "pending", retryCount: { increment: 1 } },
  })

  await prisma.adminAiJob.create({
    data: {
      type: "SOURCE_RETRY",
      status: "queued",
      title: "Retry Source",
      params: { department: "fetch-news" },
      metadata: { sourceId },
    },
  })

  revalidatePath("/admin/ai-manager/fetch-news")
}

export async function toggleSource(sourceId: string, enabled: boolean) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.feedSource.update({
    where: { id: sourceId },
    data: { enabled },
  })

  revalidatePath("/admin/ai-manager/fetch-news")
}

export async function addSource(formData: FormData) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  const url = formData.get("url") as string
  const name = formData.get("name") as string
  const topic = formData.get("topic") as string || "general"
  const intervalMinutes = Number(formData.get("intervalMinutes") ?? 30)

  if (!url || !name) throw new Error("Missing required fields")

  await prisma.feedSource.create({
    data: {
      url,
      name,
      topic,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      fetchIntervalMinutes: intervalMinutes,
      enabled: true,
      lastStatus: "pending",
    },
  })

  revalidatePath("/admin/ai-manager/fetch-news")
}

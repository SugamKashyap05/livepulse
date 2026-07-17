"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function runMissingSummaries(topic?: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")
  const where = topic ? { summary: null, topic } : { summary: null }
  const articles = await prisma.newsArticle.findMany({ where, select: { id: true } })

  if (articles.length === 0) return

  await prisma.adminAiJob.create({
    data: {
      type: "BATCH_SUMMARIZE",
      status: "queued",
      title: `Run Missing Summaries ${topic ? `(${topic})` : "(Global)"}`,
      params: { department: "copy-desk", task: "summarize", limit: articles.length },
      metadata: { articleIds: articles.map((a) => a.id), count: articles.length },
      scheduledFor: new Date(),
    },
  })

  revalidatePath("/admin/ai-manager/copy-desk")
}

export async function runMissingTaxonomy(topic?: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")
  const where = topic ? { aiTags: null, topic } : { aiTags: null }
  const articles = await prisma.newsArticle.findMany({ where, select: { id: true } })

  if (articles.length === 0) return

  await prisma.adminAiJob.create({
    data: {
      type: "BATCH_TAG",
      status: "queued",
      title: `Run Missing Taxonomy ${topic ? `(${topic})` : "(Global)"}`,
      params: { department: "copy-desk", task: "tag", limit: articles.length },
      metadata: { articleIds: articles.map((a) => a.id), count: articles.length },
      scheduledFor: new Date(),
    },
  })

  revalidatePath("/admin/ai-manager/copy-desk")
}

export async function runMissingSentiment(topic?: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")
  const where = topic ? { sentiment: null, topic } : { sentiment: null }
  const articles = await prisma.newsArticle.findMany({ where, select: { id: true } })

  if (articles.length === 0) return

  await prisma.adminAiJob.create({
    data: {
      type: "BATCH_SENTIMENT",
      status: "queued",
      title: `Run Missing Sentiment ${topic ? `(${topic})` : "(Global)"}`,
      params: { department: "copy-desk", task: "sentiment", limit: articles.length },
      metadata: { articleIds: articles.map((a) => a.id), count: articles.length },
      scheduledFor: new Date(),
    },
  })

  revalidatePath("/admin/ai-manager/copy-desk")
}

export async function runAllMissing() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")
  const articles = await prisma.newsArticle.findMany({
    where: {
      published: true,
      OR: [{ summary: null }, { aiTags: null }, { sentiment: null }],
    },
    select: { id: true },
  })

  if (articles.length === 0) return

  await prisma.adminAiJob.create({
    data: {
      type: "BATCH_COPY_ALL",
      status: "queued",
      title: "Run All Missing Copy (Global)",
      params: { department: "copy-desk", task: "all", limit: articles.length },
      metadata: { articleIds: articles.map((a) => a.id), count: articles.length },
      scheduledFor: new Date(),
    },
  })

  revalidatePath("/admin/ai-manager/copy-desk")
}

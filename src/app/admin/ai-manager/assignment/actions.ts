"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function queueNewsroomCycle() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "newsroom_cycle",
      status: "queued",
      title: "Run newsroom cycle",
      params: {},
    },
  })

  revalidatePath("/admin/ai-manager/assignment")
}

export async function queueAiBatch() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "ai_batch",
      status: "queued",
      title: "Run full AI batch",
      params: { task: "all", limit: 30 },
    },
  })

  revalidatePath("/admin/ai-manager/assignment")
}

export async function queueRagReindex() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "rag_reindex",
      status: "queued",
      title: "Reindex RAG",
      params: { mode: "missing", limit: 50 },
    },
  })

  revalidatePath("/admin/ai-manager/assignment")
}

export async function queueDigestGeneration() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "digest_generate",
      status: "queued",
      title: "Generate digest",
      params: { regen: true },
    },
  })

  revalidatePath("/admin/ai-manager/assignment")
}

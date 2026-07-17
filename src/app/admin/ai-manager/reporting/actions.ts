"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function queueScoutCycle() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "newsroom_cycle",
      status: "queued",
      title: "Run Scout cycle",
      params: {},
    },
  })

  revalidatePath("/admin/ai-manager/reporting")
}

export async function queueGenerateDrafts() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "newsroom_cycle",
      status: "queued",
      title: "Generate newsroom drafts",
      params: {},
    },
  })

  revalidatePath("/admin/ai-manager/reporting")
}

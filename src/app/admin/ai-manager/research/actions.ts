"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { validateAdminSession } from "@/lib/adminSessions"
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function queueReindexMissing() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "rag_reindex",
      status: "queued",
      title: "Index missing articles",
      params: { mode: "missing" },
    },
  })

  revalidatePath("/admin/ai-manager/research")
}

export async function queueReindexRecent() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "rag_reindex",
      status: "queued",
      title: "Reindex recent articles",
      params: { mode: "recent" },
    },
  })

  revalidatePath("/admin/ai-manager/research")
}

export async function queueReindexAll() {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  await prisma.adminAiJob.create({
    data: {
      type: "rag_reindex",
      status: "queued",
      title: "Rebuild full index",
      params: { mode: "all" },
    },
  })

  revalidatePath("/admin/ai-manager/research")
}

export async function runTestQuery(query: string) {
  if (!(await isAdminAuthorized())) throw new Error("Unauthorized")

  // For the test query, we ideally call a service, but since the component currently has testQueryEndpoint="/api/admin/rag/query", we'll just proxy the fetch or execute the logic.
  // We'll mimic what /api/admin/rag/query does.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  
  try {
    const res = await fetch(`${baseUrl}/api/admin/rag/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `admin_token=${(await cookies()).get("admin_token")?.value || ""}`
      },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) {
      throw new Error("Test query failed")
    }
    const data = await res.json()
    return data
  } catch (error: any) {
    throw new Error(error.message || "Test query failed")
  }
}

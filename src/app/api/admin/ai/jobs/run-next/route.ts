import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { runNextAdminAiJob } from "@/lib/adminAiJobs"
import { createAdminActionEvent } from "@/lib/adminDepartments"
import { prisma } from "@/lib/db"
import { purgeExpiredRagCacheEntries } from "@/lib/ragCacheCleanup"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isRunNextAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronAuthorized =
    Boolean(process.env.CRON_SECRET) &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`

  return isAdminAuthorized(request) || cronAuthorized
}

export async function POST(request: Request) {
  if (!isRunNextAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const adminRequested = await isAdminAuthorized(request)

  try {
    await Promise.all([
      prisma.adminAiJob.deleteMany({
        where: {
          status: { in: ["completed", "dead_letter", "cancelled"] },
          completedAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.managerChatMessage.deleteMany({
        where: {
          createdAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      purgeExpiredRagCacheEntries().then((count) => {
        if (count === 0) return null
        return prisma.adminDepartmentEvent.create({
          data: {
            department: "assignment",
            type: "CACHE_PURGED",
            title: "RAG cache purged",
            body: `Purged ${count} expired cache entries`,
            status: "resolved",
            severity: "info",
          },
        })
      }),
    ])

    const job = await runNextAdminAiJob()
    if (!job && adminRequested) {
      await createAdminActionEvent({
        department: "operations",
        action: "run_next",
        title: "Queue runner checked",
        body: "No queued, retryable, or stale AI task was ready to run.",
        severity: "info",
        notify: false,
        metadata: {
          targetType: "job",
          status: "idle",
        },
      })
    }
    return NextResponse.json({ success: true, job })
  } catch (error) {
    console.error("[api/admin/ai/jobs/run-next] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

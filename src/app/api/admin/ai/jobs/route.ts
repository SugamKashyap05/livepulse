import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { validateJobParams, type JobType } from "@/lib/adminJobSchemas"
import {
  createAdminAiJob,
  normalizeAdminAiJobType,
} from "@/lib/adminAiJobs"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const jobs = await prisma.adminAiJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    })
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("[api/admin/ai/jobs] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const type = normalizeAdminAiJobType((body as { type?: unknown }).type)
    if (!type) {
      return NextResponse.json({ error: "Invalid job type" }, { status: 400 })
    }

    const params = (body as { params?: unknown }).params ?? {}
    const validation = validateJobParams(type as JobType, params)
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid params: ${validation.error}` },
        { status: 400 }
      )
    }
    const rawTitle = (body as { title?: unknown }).title
    const title = typeof rawTitle === "string" ? rawTitle.slice(0, 160) : ""
    const rawMaxRetries = (body as { maxRetries?: unknown }).maxRetries
    const maxRetries =
      typeof rawMaxRetries === "number" ? Math.min(Math.max(rawMaxRetries, 0), 10) : undefined
    const rawParentJobId = (body as { parentJobId?: unknown }).parentJobId
    const parentJobId =
      typeof rawParentJobId === "string" && rawParentJobId ? rawParentJobId : null
    const rawScheduledFor = (body as { scheduledFor?: unknown }).scheduledFor
    const scheduledFor =
      typeof rawScheduledFor === "string" && !Number.isNaN(Date.parse(rawScheduledFor))
        ? new Date(rawScheduledFor)
        : null

    const existingActiveJob = await prisma.adminAiJob.findFirst({
      where: {
        type,
        status: { in: ["queued", "running"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    if (existingActiveJob) {
      return NextResponse.json(
        {
          error: `A ${type} job is already running`,
          existingJobId: existingActiveJob.id,
        },
        { status: 409 }
      )
    }

    const job = await createAdminAiJob({
      type,
      title,
      params: validation.data,
      maxRetries,
      scheduledFor,
      parentJobId,
    })

    return NextResponse.json({ success: true, job })
  } catch (error) {
    console.error("[api/admin/ai/jobs] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

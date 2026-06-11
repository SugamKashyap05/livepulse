import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { validateJobParams, type JobType } from "@/lib/adminJobSchemas"
import {
  normalizeAdminAiJobType,
  previewAdminAiJob,
} from "@/lib/adminAiJobs"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
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

    const preview = await previewAdminAiJob(type, validation.data)
    return NextResponse.json({ success: true, preview })
  } catch (error) {
    console.error("[api/admin/ai/jobs/preview] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

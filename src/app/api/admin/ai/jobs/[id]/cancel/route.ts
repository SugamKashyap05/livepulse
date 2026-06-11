import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { cancelAdminAiJob } from "@/lib/adminAiJobs"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const job = await cancelAdminAiJob(id)
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, job })
  } catch (error) {
    console.error("[api/admin/ai/jobs/cancel] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

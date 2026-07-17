import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    { error: "Moved to /api/admin/ai/newsroom/activity" },
    { status: 410 }
  )
}

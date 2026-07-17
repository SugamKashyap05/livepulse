import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { getRagStatus } from "@/lib/rag"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(await getRagStatus())
  } catch (error) {
    console.error("[api/admin/rag/status] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

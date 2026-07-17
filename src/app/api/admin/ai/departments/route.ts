import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { getDepartmentSummaries } from "@/lib/adminDepartments"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const departments = await getDepartmentSummaries()
    return NextResponse.json({ departments })
  } catch (error) {
    console.error("[api/admin/ai/departments] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

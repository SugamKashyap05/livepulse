import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { normalizeDepartmentSlug } from "@/lib/adminDepartments"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ department: string }> }
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { department: slug } = await params
    const department = normalizeDepartmentSlug(slug)
    if (!department) {
      return NextResponse.json({ error: "Invalid department" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const id = (body as { id?: unknown }).id
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const now = new Date()
    await prisma.adminDepartmentEvent.updateMany({
      where: { id, department },
      data: {
        status: "resolved",
        resolvedAt: now,
        readAt: now,
        needsEditorReview: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/admin/ai/departments/events/resolve] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

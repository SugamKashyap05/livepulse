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
    const now = new Date()

    if (typeof id === "string" && id) {
      await prisma.adminDepartmentEvent.updateMany({
        where: { id, department },
        data: { status: "read", readAt: now },
      })
    } else {
      await prisma.adminDepartmentEvent.updateMany({
        where: { department, status: "unread" },
        data: { status: "read", readAt: now },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/admin/ai/departments/events/read] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

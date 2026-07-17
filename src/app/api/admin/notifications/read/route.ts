import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = (body as { id?: unknown }).id
    const markAll = (body as { all?: unknown }).all === true
    const now = new Date()

    if (markAll) {
      await prisma.adminNotification.updateMany({
        where: { status: "unread" },
        data: { status: "read", readAt: now },
      })
      return NextResponse.json({ success: true })
    }

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    await prisma.adminNotification.update({
      where: { id },
      data: { status: "read", readAt: now },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api/admin/notifications/read] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

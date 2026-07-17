import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          status: true,
          jobId: true,
          department: true,
          severity: true,
          departmentEventId: true,
          readAt: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              type: true,
              status: true,
              title: true,
              createdAt: true,
              completedAt: true,
            },
          },
        },
      }),
      prisma.adminNotification.count({ where: { status: "unread" } }),
    ])

    prisma.adminNotification
      .deleteMany({
        where: {
          status: "read",
          createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      })
      .catch(() => {})

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("[api/admin/notifications] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

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
    console.error("[api/admin/notifications] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

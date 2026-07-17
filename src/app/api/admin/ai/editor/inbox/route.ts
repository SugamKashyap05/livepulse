import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const events = await prisma.adminDepartmentEvent.findMany({
      where: {
        needsEditorReview: true,
        status: { notIn: ["resolved", "archived"] },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        job: {
          select: {
            id: true,
            type: true,
            status: true,
            title: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error("[api/admin/ai/editor/inbox] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

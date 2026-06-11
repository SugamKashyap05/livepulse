import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { normalizeDepartmentSlug } from "@/lib/adminDepartments"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
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

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
    const events = await prisma.adminDepartmentEvent.findMany({
      where: { department },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        job: {
          select: {
            id: true,
            type: true,
            status: true,
            title: true,
            progress: true,
            phase: true,
            retryCount: true,
            maxRetries: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error("[api/admin/ai/departments/events] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

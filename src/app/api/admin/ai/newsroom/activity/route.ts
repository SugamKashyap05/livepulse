import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const activity = await prisma.agentActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json(activity)
  } catch (e) {
    console.error("[api/admin/ai/newsroom/activity] error:", e)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const activity = await prisma.agentActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return NextResponse.json(activity)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

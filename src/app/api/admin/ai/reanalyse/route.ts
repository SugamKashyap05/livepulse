import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { runFactChecker, runSpinDoctor } from "@/lib/agents"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    await runFactChecker(id)
    await runSpinDoctor(id)

    const updated = await prisma.newsArticle.findUnique({
      where: { id },
      select: { factScore: true, biasAnalysis: true, agentNotes: true },
    })

    return NextResponse.json({ success: true, ...updated })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

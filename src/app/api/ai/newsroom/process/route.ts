import { NextResponse } from "next/server"
import { runFullAgenticCycle } from "@/lib/agents"
import { isAdminAuthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // Long processing

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await runFullAgenticCycle()

    return NextResponse.json({
      success: true,
      message: "Agentic cycle and generation completed."
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

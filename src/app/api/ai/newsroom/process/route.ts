import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { runFullAgenticCycle } from "@/lib/agents"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // Long processing

export async function POST() {
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

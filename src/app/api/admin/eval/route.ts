import { NextResponse } from "next/server"
import { benchmarkDailyUsage, runRagEvaluation } from "@/lib/ragEval"
import { isAdminAuthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { runEval } = await request.json().catch(() => ({ runEval: false }))
    
    let evalResults = null
    if (runEval) {
      await runRagEvaluation()
    }
    
    const benchmark = await benchmarkDailyUsage()

    return NextResponse.json({ success: true, benchmark, ranEval: runEval })
  } catch (error) {
    console.error("[LivePulse Eval] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

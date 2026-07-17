import { NextResponse } from "next/server"
import { benchmarkDailyUsage, runRagEvaluation } from "@/lib/ragEval"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) {
    console.error('[Security] INTERNAL_CRON_SECRET not configured');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

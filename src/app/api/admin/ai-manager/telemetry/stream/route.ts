import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Initial state
        const jobs = await prisma.adminAiJob.findMany({
          take: 20,
          orderBy: { createdAt: "desc" },
          where: { status: { in: ["queued", "running", "thinking"] } },
        })

        const logs = await prisma.aiLog.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
        })

        const activities = await prisma.agentActivity.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
        })

        sendEvent({ type: "init", jobs, logs, activities })

        let lastCheck = new Date()

        // Poll every 2 seconds for new updates
        const interval = setInterval(async () => {
          try {
            const newDate = new Date()
            
            // Only fetch what has changed
            const newJobs = await prisma.adminAiJob.findMany({
              where: { updatedAt: { gt: lastCheck } },
              orderBy: { updatedAt: "asc" },
            })
            
            const newLogs = await prisma.aiLog.findMany({
              where: { createdAt: { gt: lastCheck } },
              orderBy: { createdAt: "asc" },
            })
            
            const newActivities = await prisma.agentActivity.findMany({
              where: { createdAt: { gt: lastCheck } },
              orderBy: { createdAt: "asc" },
            })

            if (newJobs.length > 0 || newLogs.length > 0 || newActivities.length > 0) {
              sendEvent({
                type: "update",
                jobs: newJobs,
                logs: newLogs,
                activities: newActivities,
              })
            }
            lastCheck = newDate
          } catch (e) {
            console.error("[Telemetry SSE Polling Error]", e)
          }
        }, 2000)

        // Cleanup on disconnect
        req.signal.addEventListener("abort", () => {
          clearInterval(interval)
          controller.close()
        })
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

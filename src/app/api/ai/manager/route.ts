import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { MODELS, managerChat, logAiAction, OllamaMessage } from "@/lib/ollama"

export const maxDuration = 60

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages } = await request.json()

    const totalArticles = await prisma.newsArticle.count()

    const topicsRaw = await prisma.newsArticle.groupBy({
      by: ["topic"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })

    const newest = await prisma.newsArticle.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    })

    const aiLogs = await prisma.aiLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    const context = {
      totalArticles,
      topics: topicsRaw.map((t) => `${t.topic}(${t._count.id})`),
      lastSync: newest?.fetchedAt
        ? new Date(newest.fetchedAt).toLocaleString()
        : "Never",
      recentAiActions: aiLogs.map((l) =>
        `${l.action} via ${l.model} — ${l.ms}ms`
      ),
    }

    const model = MODELS.MANAGER
    const start = Date.now()
    let reply: string
    try {
      reply = await managerChat(messages as OllamaMessage[], context)
    } catch (error) {
      console.error("[AI manager unavailable]:", error)
      await logAiAction({
        action: "manager",
        model,
        prompt: JSON.stringify(context).slice(0, 200),
        tokens: null,
        ms: null,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }).catch(() => {})
      return NextResponse.json(
        { error: "AI service unavailable", fallback: true },
        { status: 503 }
      )
    }
    const ms = Date.now() - start

    await logAiAction({
      action: "manager",
      model,
      prompt: JSON.stringify(context).slice(0, 200),
      tokens: null,
      ms,
      success: true,
    })

    return NextResponse.json({ reply, model })
  } catch (error) {
    console.error("[ai manager] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

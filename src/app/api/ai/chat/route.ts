import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, ollamaChat, logAiAction, OllamaMessage } from "@/lib/ollama"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { messages, topic } = await request.json()

    const recentArticles = await prisma.newsArticle.findMany({
      where: topic && topic !== "all"
        ? { topic: { equals: topic } }
        : {},
      orderBy: { pubDate: "desc" },
      take: 20,
      select: { title: true, source: true, topic: true, description: true, link: true },
    })

    const context = recentArticles
      .map((a, i) => `${i + 1}. [${a.topic}] ${a.title} — ${a.source}${a.description ? `\n   ${a.description.slice(0, 100)}` : ""}`)
      .join("\n")

    const systemPrompt = `You are a knowledgeable news assistant for LivePulse, a real-time news aggregator.
You have access to the latest articles in the database. Answer questions about current news clearly and concisely.
Always cite the source when referencing a specific article.
If asked about something not in the articles, say so honestly.

Current news context (latest ${recentArticles.length} articles):
${context}`

    const chatMessages: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ]

    const model = MODELS.CHAT
    const start = Date.now()
    let result: Awaited<ReturnType<typeof ollamaChat>>
    try {
      result = await ollamaChat(model, chatMessages, {
        temperature: 0.6,
        maxTokens: 512,
      })
    } catch (error) {
      console.error("[AI chat unavailable]:", error)
      return NextResponse.json(
        { error: "AI service unavailable", fallback: true },
        { status: 503 }
      )
    }
    const ms = Date.now() - start

    await logAiAction("chat", model, ms, result.tokens)

    return NextResponse.json({ reply: result.content, model })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

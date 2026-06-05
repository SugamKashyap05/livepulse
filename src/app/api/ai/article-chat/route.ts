import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, OllamaMessage, logAiAction, ollamaChat } from "@/lib/ollama"

export const maxDuration = 60

type IncomingMessage = {
  role: "user" | "assistant"
  content: string
}

function isValidMessage(message: unknown): message is IncomingMessage {
  if (!message || typeof message !== "object") return false

  const candidate = message as Partial<IncomingMessage>
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length > 0
  )
}

function parseTags(aiTags: string | null) {
  try {
    const tags = aiTags ? JSON.parse(aiTags) : []
    return Array.isArray(tags) ? tags.map(String).join(", ") : "none"
  } catch {
    return "none"
  }
}

export async function POST(request: Request) {
  try {
    const { articleId, messages } = await request.json()

    if (!articleId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "articleId and messages required" },
        { status: 400 }
      )
    }

    const chatHistory = messages.filter(isValidMessage).slice(-12)
    if (chatHistory.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const article = await prisma.newsArticle.findFirst({
      where: { id: articleId, published: true },
      select: {
        title: true,
        description: true,
        source: true,
        topic: true,
        summary: true,
        sentiment: true,
        aiTags: true,
        pubDate: true,
      },
    })

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    const systemPrompt = `You are LivePulse's article assistant.
Answer only using the article context below. If the user asks for facts not present in this context, say that the article excerpt does not include that information.
Do not invent details. Keep answers concise and cite the source name when useful.

Article context:
Title: ${article.title}
Source: ${article.source}
Topic: ${article.topic}
Published: ${article.pubDate.toISOString()}
Sentiment: ${article.sentiment || "unknown"}
Tags: ${parseTags(article.aiTags)}
Description excerpt: ${article.description || "No excerpt available."}
AI summary: ${article.summary || "No AI summary available."}`

    const ollamaMessages: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
    ]

    const model = MODELS.CHAT
    let result: Awaited<ReturnType<typeof ollamaChat>>
    try {
      result = await ollamaChat(model, ollamaMessages, {
        temperature: 0.4,
        maxTokens: 420,
      })
    } catch (error) {
      console.error("[AI article chat unavailable]:", error)
      await logAiAction({
        action: "article-chat",
        model,
        prompt: systemPrompt.slice(0, 200),
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

    await logAiAction({
      action: "article-chat",
      model,
      prompt: systemPrompt.slice(0, 200),
      tokens: result.tokens ?? null,
      ms: result.ms ?? null,
      success: true,
    })

    return NextResponse.json({ reply: result.content, model })
  } catch (error) {
    console.error("[ai article-chat] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

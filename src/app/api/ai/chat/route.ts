import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, ollamaChat, logAiAction, OllamaMessage } from "@/lib/ollama"
import { getMutableCurrentUserId } from "@/lib/auth"
import type { Prisma } from "@prisma/client"

export const maxDuration = 60

const VALID_TOPICS = new Set([
  "all",
  "world",
  "technology",
  "india",
  "business",
  "science",
  "sports",
  "health",
  "climate",
  "politics",
])

const ALLOWED_ROLES = new Set(["user", "assistant"])

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messages } = body
    const rawTopic = body.topic
    const topic =
      typeof rawTopic === "string" && VALID_TOPICS.has(rawTopic.toLowerCase())
        ? rawTopic.toLowerCase()
        : "all"
    const userId = await getMutableCurrentUserId()
    let followedTopics: string[] = []

    if (userId) {
      const follows = await prisma.userTopicFollow.findMany({
        where: { userId },
        select: { topicSlug: true },
      })
      followedTopics = follows.map((follow) => follow.topicSlug)
    }

    const where: Prisma.NewsArticleWhereInput =
      topic && topic !== "all"
        ? { topic: { equals: topic } }
        : followedTopics.length > 0
          ? { topic: { in: followedTopics } }
          : {}

    const recentArticles = await prisma.newsArticle.findMany({
      where,
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

    const sanitizedMessages = (Array.isArray(messages) ? messages : [])
      .filter(
        (message: unknown) =>
          typeof message === "object" &&
          message !== null &&
          "role" in message &&
          "content" in message &&
          ALLOWED_ROLES.has((message as { role?: unknown }).role as string) &&
          typeof (message as { content?: unknown }).content === "string" &&
          ((message as { content: string }).content).length <= 2000
      )
      .slice(-20)
      .map((message) => ({
        role: (message as { role: "user" | "assistant" }).role,
        content: (message as { content: string }).content
          .replace(/[<>]/g, "")
          .trim(),
      }))

    const chatMessages: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizedMessages,
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
      await logAiAction({
        action: "chat",
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
    const ms = Date.now() - start

    await logAiAction({
      action: "chat",
      model,
      prompt: systemPrompt.slice(0, 200),
      tokens: result.tokens ?? null,
      ms: result.ms ?? ms,
      success: true,
    })

    return NextResponse.json({ reply: result.content, model })
  } catch (error) {
    console.error("[ai chat] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

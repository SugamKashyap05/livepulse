import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, logAiAction, structuredChat, isAiOverloaded, AI_PROVIDER } from "@/lib/ollama"
import { getCurrentUserId } from "@/lib/auth"
import { enforceInputLimit } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (isAiOverloaded()) {
      return NextResponse.json({ error: "AI service is currently busy processing other requests. Please try again later." }, { status: 429 })
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const inputText = body.text ?? body.message ?? (body.messages ? JSON.stringify(body.messages) : "");
    if (inputText.length > 5000) {
      return NextResponse.json(
        { error: "Input too large." },
        { status: 413 }
      );
    }
    const id = enforceInputLimit(body?.id, 100)

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const article = await prisma.newsArticle.findFirst({
      where: { id, published: true },
      select: {
        id: true,
        title: true,
        description: true,
        topic: true,
        sentiment: true,
      },
    })

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      )
    }

    if (article.sentiment) {
      return NextResponse.json({ sentiment: article.sentiment, cached: true })
    }

    const { title, description } = article

    const systemPrompt = `Analyze the sentiment of this news article. Is it Positive, Neutral, or Negative?
Return as JSON: { "sentiment": "positive" | "neutral" | "negative", "confidence": 0.0-1.0 }`
    
    const userMessage = `Title: ${title}
Description: ${description || ""}`

    const startMs = Date.now()
    let response: { sentiment: string, confidence: number }
    try {
      response = await structuredChat<{ sentiment: string, confidence: number }>(systemPrompt, userMessage, MODELS.fast)
    } catch (error) {
      console.error("[AI sentiment unavailable]:", error)
      await logAiAction({
        action: "sentiment",
        model: MODELS.fast,
        provider: AI_PROVIDER,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        articleId: article.id
      }).catch(() => {})
      return NextResponse.json(
        { error: "AI service unavailable", fallback: true },
        { status: 503 }
      )
    }
    const ms = Date.now() - startMs

    const VALID_SENTIMENTS = ["positive", "neutral", "negative"]
    const normalizedSentiment = response.sentiment?.toLowerCase()
    const sentiment = normalizedSentiment && VALID_SENTIMENTS.includes(normalizedSentiment)
      ? normalizedSentiment
      : "neutral"

    await prisma.newsArticle.update({
      where: { id: article.id },
      data: { sentiment, scored: true },
    })

    await logAiAction({
      action: "sentiment",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      durationMs: ms,
      success: true,
      articleId: article.id
    })

    return NextResponse.json({ sentiment, cached: false })
  } catch (error) {
    console.error("[ai sentiment] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

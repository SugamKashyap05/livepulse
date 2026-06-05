import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, logAiAction, structuredChat } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const article = await prisma.newsArticle.findFirst({
      where: { id, published: true },
      select: { id: true, title: true, description: true, sentiment: true },
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

    const prompt = `Analyze the sentiment of this news article. Is it Positive, Neutral, or Negative?
        
Title: ${title}
Description: ${description || ""}

Return as JSON: { "sentiment": "positive" | "neutral" | "negative", "confidence": 0.0-1.0 }`

    const start = Date.now()
    let response: { sentiment: string, confidence: number }
    try {
      response = await structuredChat<{ sentiment: string, confidence: number }>(prompt, MODELS.FAST)
    } catch (error) {
      console.error("[AI sentiment unavailable]:", error)
      await logAiAction({
        action: "sentiment",
        model: MODELS.FAST,
        prompt: prompt.slice(0, 200),
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
      model: MODELS.FAST,
      prompt: prompt.slice(0, 200),
      tokens: null,
      ms,
      success: true,
    })

    return NextResponse.json({ sentiment, cached: false })
  } catch (error) {
    console.error("[ai sentiment] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

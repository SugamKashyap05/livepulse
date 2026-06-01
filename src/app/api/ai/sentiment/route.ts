import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, structuredChat } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { id, title, description } = await request.json()

    if (!id || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const existing = await prisma.newsArticle.findUnique({
      where: { id },
      select: { sentiment: true },
    })

    if (existing?.sentiment) {
      return NextResponse.json({ sentiment: existing.sentiment, cached: true })
    }

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
      where: { id },
      data: { sentiment, scored: true },
    })

    // Log action
    await prisma.aiLog.create({
      data: {
        action: "sentiment",
        model: MODELS.FAST,
        prompt: title.substring(0, 100),
        ms,
      }
    })

    return NextResponse.json({ sentiment, cached: false })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

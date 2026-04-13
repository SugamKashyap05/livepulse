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
    const response = await structuredChat<{ sentiment: string, confidence: number }>(prompt, MODELS.FAST)
    const ms = Date.now() - start

    const sentiment = response.sentiment.toLowerCase()

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

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, chat } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { id, title, description } = await request.json()

    if (!id || !title) {
      return NextResponse.json({ error: "Missing id or title" }, { status: 400 })
    }

    const existing = await prisma.newsArticle.findUnique({
      where: { id },
      select: { summary: true },
    })

    if (existing?.summary) {
      return NextResponse.json({ summary: existing.summary, cached: true })
    }

    const prompt = `Summarize the following news article in exactly 3 concise bullet points. Focus on the core facts.
    
Title: ${title}
Description: ${description || "N/A"}

Summary:`

    const start = Date.now()
    let aiResponse: Awaited<ReturnType<typeof chat>>
    try {
      aiResponse = await chat(prompt, MODELS.SUMMARY)
    } catch (error) {
      console.error("[AI summarize unavailable]:", error)
      return NextResponse.json(
        { error: "AI service unavailable", fallback: true },
        { status: 503 }
      )
    }
    const ms = Date.now() - start

    await prisma.newsArticle.update({
      where: { id },
      data: { summary: aiResponse.text },
    })

    // Log action
    await prisma.aiLog.create({
      data: {
        action: "summarize",
        model: MODELS.SUMMARY,
        prompt: title.substring(0, 100),
        ms,
      }
    })

    return NextResponse.json({ summary: aiResponse.text, cached: false })
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}

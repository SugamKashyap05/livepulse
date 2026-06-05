import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, chat, logAiAction } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { id, force = false } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const article = await prisma.newsArticle.findFirst({
      where: { id, published: true },
      select: { id: true, title: true, description: true, summary: true },
    })

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      )
    }

    if (article.summary && !force) {
      return NextResponse.json({ summary: article.summary, cached: true })
    }

    const { title, description } = article

    const prompt = `Create a useful reader briefing for this news article using only the title and syndicated excerpt below.

Return 5-7 concise bullet points. Include:
- The core news
- Important context
- Who or what is affected
- Why it matters
- What to watch next, if the excerpt supports it

Do not invent facts that are not present in the excerpt.
    
Title: ${title}
Description: ${description || "N/A"}

Reader briefing:`

    const start = Date.now()
    let aiResponse: Awaited<ReturnType<typeof chat>>
    try {
      aiResponse = await chat(prompt, MODELS.SUMMARY)
    } catch (error) {
      console.error("[AI summarize unavailable]:", error)
      await logAiAction({
        action: "summarize",
        model: MODELS.SUMMARY,
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

    await prisma.newsArticle.update({
      where: { id: article.id },
      data: { summary: aiResponse.text },
    })

    await logAiAction({
      action: "summarize",
      model: MODELS.SUMMARY,
      prompt: prompt.slice(0, 200),
      tokens: aiResponse.tokens ?? null,
      ms: aiResponse.ms ?? ms,
      success: true,
    })

    return NextResponse.json({ summary: aiResponse.text, cached: false })
  } catch (error) {
    console.error("[ai summarize] error:", error)
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}

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
      select: {
        id: true,
        title: true,
        description: true,
        topic: true,
        aiTags: true,
      },
    })

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      )
    }

    if (article.aiTags) {
      return NextResponse.json({
        tags: JSON.parse(article.aiTags),
        cached: true,
      })
    }

    const { title, description, topic } = article

    const prompt = `Read this news article and provide 3-5 very specific keywords/tags (e.g., "Gaza", "NVIDIA", "Cricket World Cup").
        
Title: ${title}
Description: ${description || ""}
Primary Topic: ${topic || "General"}

Return as JSON: { "tags": ["tag1", "tag2", ...] }`

    const start = Date.now()
    let response: { tags: string[] }
    try {
      response = await structuredChat<{ tags: string[] }>(prompt, MODELS.FAST)
    } catch (error) {
      console.error("[AI tag unavailable]:", error)
      await logAiAction({
        action: "tag",
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

    await prisma.newsArticle.update({
      where: { id: article.id },
      data: {
        aiTags: JSON.stringify(response.tags),
        aiProcessed: true,
      },
    })

    await logAiAction({
      action: "tag",
      model: MODELS.FAST,
      prompt: prompt.slice(0, 200),
      tokens: null,
      ms,
      success: true,
    })

    return NextResponse.json({ tags: response.tags, cached: false })
  } catch (error) {
    console.error("[ai tag] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

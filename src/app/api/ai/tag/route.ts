import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, logAiAction, structuredChat, AI_PROVIDER } from "@/lib/ollama"
import { getCurrentUserId } from "@/lib/auth"
import { enforceInputLimit } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
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

    const systemPrompt = `Read this news article and provide 3-5 very specific keywords/tags (e.g., "Gaza", "NVIDIA", "Cricket World Cup").
Return as JSON: { "tags": ["tag1", "tag2", ...] }`

    const userMessage = `Title: ${title}
Description: ${description || ""}
Primary Topic: ${topic || "General"}`

    const startMs = Date.now()
    let response: { tags: string[] }
    try {
      response = await structuredChat<{ tags: string[] }>(systemPrompt, userMessage, MODELS.fast)
    } catch (error) {
      console.error("[AI tag unavailable]:", error)
      await logAiAction({
        action: "tag",
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

    await prisma.newsArticle.update({
      where: { id: article.id },
      data: {
        aiTags: JSON.stringify(response.tags),
        aiProcessed: true,
      },
    })

    await logAiAction({
      action: "tag",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      durationMs: ms,
      success: true,
      articleId: article.id
    })

    return NextResponse.json({ tags: response.tags, cached: false })
  } catch (error) {
    console.error("[ai tag] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

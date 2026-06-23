import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, logAiAction, aiClient, withRetry, AI_PROVIDER } from "@/lib/ollama"
import { getCurrentUserId } from "@/lib/auth"
import { enforceInputLimit, sanitizeAiOutput } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const inputText = body.text ?? body.message ?? (body.messages ? JSON.stringify(body.messages) : "");
    if (inputText.length > 50000) {
      return NextResponse.json(
        { error: "Input too large." },
        { status: 413 }
      );
    }
    const id = enforceInputLimit(body?.id, 100)
    const force = body?.force === true

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
        summary: true,
      },
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

    const startMs = Date.now()
    let aiResponse: string
    let promptTokens = 0
    let completionTokens = 0
    try {
      const completion = await withRetry(() => aiClient.chat.completions.create({
        model: MODELS.fast,
        messages: [{ role: "user", content: prompt }]
      }, { timeout: 15000 }))
      aiResponse = sanitizeAiOutput(completion.choices[0]?.message?.content ?? "")
      promptTokens = completion.usage?.prompt_tokens ?? 0
      completionTokens = completion.usage?.completion_tokens ?? 0
    } catch (error) {
      console.error("[AI summarize unavailable]:", error)
      await logAiAction({
        action: "summarize",
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
      data: { summary: aiResponse },
    })

    await logAiAction({
      action: "summarize",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      promptTokens,
      completionTokens,
      durationMs: ms,
      success: true,
      articleId: article.id
    })

    return NextResponse.json({ summary: aiResponse, cached: false })
  } catch (error) {
    console.error("[ai summarize] error:", error)
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    )
  }
}

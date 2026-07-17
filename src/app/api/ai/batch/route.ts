import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { MODELS, structuredChat, logAiAction, aiClient, withRetry, AI_PROVIDER } from "@/lib/ollama"
import { sanitizeAiOutput } from "@/lib/security"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const task = body.task
    const rawLimit = parseInt(body.limit ?? "20")
    const limit = Number.isNaN(rawLimit)
      ? 20
      : Math.min(Math.max(1, rawLimit), 50)

    const articles = await prisma.newsArticle.findMany({
      where:
        task === "sentiment"
          ? { sentiment: null }
          : task === "tag"
          ? { aiTags: null }
          : task === "summarize"
          ? { summary: null }
          : {
              OR: [
                { scored: false },
                { aiTags: null },
                { summary: null },
              ],
            },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        topic: true,
      },
    })

    if (articles.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "All articles already processed" })
    }

    let processedCount = 0
    let failedCount = 0

    for (const article of articles) {
      try {
        // Sentiment Processing
        if (task === "sentiment" || task === "all") {
          const systemPrompt = `Analyze the sentiment. Return JSON: { "sentiment": "positive" | "neutral" | "negative", "confidence": 0.0-1.0 }`
          const userMessage = article.title
          const start = Date.now()
          const res = await structuredChat<{ sentiment: string }>(systemPrompt, userMessage, MODELS.fast)
          const ms = Date.now() - start
          
          await prisma.newsArticle.update({
            where: { id: article.id },
            data: { sentiment: res.sentiment.toLowerCase(), scored: true },
          })
          
          await logAiAction({
            action: "sentiment_batch",
            model: MODELS.fast,
            provider: AI_PROVIDER,
            durationMs: ms,
            success: true,
            articleId: article.id
          })
        }

        // Tagging Processing
        if (task === "tag" || task === "all") {
          const systemPrompt = `Tag this article with 3-5 keywords. Return JSON: { "tags": ["tag1", "tag2", ...] }`
          const userMessage = article.title
          const start = Date.now()
          const res = await structuredChat<{ tags: string[] }>(systemPrompt, userMessage, MODELS.fast)
          const ms = Date.now() - start

          await prisma.newsArticle.update({
            where: { id: article.id },
            data: { aiTags: JSON.stringify(res.tags), aiProcessed: true },
          })

          await logAiAction({
            action: "tag_batch",
            model: MODELS.fast,
            provider: AI_PROVIDER,
            durationMs: ms,
            success: true,
            articleId: article.id
          })
        }

        // Summary Processing
        if (task === "summarize" || task === "all") {
          const prompt = `Summarize in 3 concise bullet points: ${article.title}. \n\n ${article.description || ""}`
          const start = Date.now()
          const completion = await withRetry(() => aiClient.chat.completions.create({
            model: MODELS.fast,
            messages: [{ role: "user", content: prompt }]
          }))
          const text = sanitizeAiOutput(completion.choices[0]?.message?.content ?? "")
          const promptTokens = completion.usage?.prompt_tokens ?? 0
          const completionTokens = completion.usage?.completion_tokens ?? 0
          const ms = Date.now() - start

          await prisma.newsArticle.update({
            where: { id: article.id },
            data: { summary: text },
          })

          await logAiAction({
            action: "summary_batch",
            model: MODELS.fast,
            provider: AI_PROVIDER,
            promptTokens,
            completionTokens,
            durationMs: ms,
            success: true,
            articleId: article.id
          })
        }

        processedCount++
      } catch (err) {
        console.error("Failed to process article", article.id, ":", err)
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      failed: failedCount,
      total: articles.length,
    })
  } catch (error) {
    console.error("[ai batch] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

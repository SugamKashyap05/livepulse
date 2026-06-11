import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { MODELS, chat, structuredChat } from "@/lib/ollama"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
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
          const prompt = `Analyze the sentiment: ${article.title}. Return JSON: { "sentiment": "positive" | "neutral" | "negative", "confidence": 0.0-1.0 }`
          const start = Date.now()
          const res = await structuredChat<{ sentiment: string }>(prompt, MODELS.FAST)
          const ms = Date.now() - start
          
          await prisma.newsArticle.update({
            where: { id: article.id },
            data: { sentiment: res.sentiment.toLowerCase(), scored: true },
          })
          
          await prisma.aiLog.create({
            data: { action: "sentiment_batch", model: MODELS.FAST, prompt: article.title.substring(0, 50), ms }
          })
        }

        // Tagging Processing
        if (task === "tag" || task === "all") {
          const prompt = `Tag this article with 3-5 keywords: ${article.title}. Return JSON: { "tags": ["tag1", "tag2", ...] }`
          const start = Date.now()
          const res = await structuredChat<{ tags: string[] }>(prompt, MODELS.FAST)
          const ms = Date.now() - start

          await prisma.newsArticle.update({
            where: { id: article.id },
            data: { aiTags: JSON.stringify(res.tags), aiProcessed: true },
          })

          await prisma.aiLog.create({
            data: { action: "tag_batch", model: MODELS.FAST, prompt: article.title.substring(0, 50), ms }
          })
        }

        // Summary Processing
        if (task === "summarize" || task === "all") {
          const prompt = `Summarize in 3 concise bullet points: ${article.title}. \n\n ${article.description || ""}`
          const start = Date.now()
          const res = await chat(prompt, MODELS.SUMMARY)
          const ms = Date.now() - start

          await prisma.newsArticle.update({
            where: { id: article.id },
            data: { summary: res.text },
          })

          await prisma.aiLog.create({
            data: { action: "summary_batch", model: MODELS.SUMMARY, prompt: article.title.substring(0, 50), ms }
          })
        }

        processedCount++
      } catch (err) {
        console.error(`Failed to process article ${article.id}:`, err)
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

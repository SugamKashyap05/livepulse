import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateDigest, logAiAction } from "@/lib/ollama"

export const maxDuration = 60

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)

    const existing = await prisma.dailyDigest.findUnique({
      where: { date: today },
    })

    if (existing) {
      return NextResponse.json({
        digest: existing.content,
        date: today,
        cached: true,
        model: existing.model,
      })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const articles = await prisma.newsArticle.findMany({
      where: { fetchedAt: { gte: todayStart } },
      orderBy: { pubDate: "desc" },
      take: 30,
      select: { title: true, source: true, topic: true },
    })

    if (articles.length === 0) {
      const fallback = await prisma.newsArticle.findMany({
        orderBy: { pubDate: "desc" },
        take: 30,
        select: { title: true, source: true, topic: true },
      })
      articles.push(...fallback)
    }

    const start = Date.now()
    const model = process.env.OLLAMA_MODEL_DIGEST || "llama3"
    let content: string
    try {
      content = await generateDigest(articles)
    } catch (error) {
      console.error("[AI digest unavailable]:", error)
      return NextResponse.json(
        { error: "AI service unavailable", fallback: true },
        { status: 503 }
      )
    }
    const ms = Date.now() - start

    await prisma.dailyDigest.upsert({
      where: { date: today },
      update: { content, model },
      create: { date: today, content, model },
    })

    await logAiAction("digest", model, ms)

    return NextResponse.json({ digest: content, date: today, cached: false, model })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE() {
  const today = new Date().toISOString().slice(0, 10)
  await prisma.dailyDigest.deleteMany({ where: { date: today } })
  return NextResponse.json({ success: true, message: "Digest cleared — regenerate by calling GET" })
}

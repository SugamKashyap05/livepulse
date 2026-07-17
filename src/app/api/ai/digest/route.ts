import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getMutableCurrentUserId } from "@/lib/auth"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { generateDigest, logAiAction } from "@/lib/ollama"

export const maxDuration = 60

function getDigestKey(today: string, userId: string | null) {
  return userId ? `${today}-user-${userId}` : today
}

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const userId = await getMutableCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const digestKey = getDigestKey(today, userId)
    let topicFilter: string[] = []

    if (userId) {
      const follows = await prisma.userTopicFollow.findMany({
        where: { userId },
        select: { topicSlug: true },
      })
      topicFilter = follows.map((follow) => follow.topicSlug)
    }

    const existing = await prisma.dailyDigest.findUnique({
      where: { date: digestKey },
    })

    if (existing) {
      return NextResponse.json({
        digest: existing.content,
        date: digestKey,
        cached: true,
        model: existing.model,
      })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const articleWhere: Prisma.NewsArticleWhereInput = {
      published: true,
      fetchedAt: { gte: todayStart },
      ...(topicFilter.length > 0 ? { topic: { in: topicFilter } } : {}),
    }
    const articleSelect = {
      title: true,
      source: true,
      topic: true,
      description: true,
      sentiment: true,
    } satisfies Prisma.NewsArticleSelect

    const articles = await prisma.newsArticle.findMany({
      where: articleWhere,
      orderBy: { pubDate: "desc" },
      take: 30,
      select: articleSelect,
    })

    if (articles.length === 0) {
      const fallback = await prisma.newsArticle.findMany({
        where: topicFilter.length > 0
          ? { published: true, topic: { in: topicFilter } }
          : { published: true },
        orderBy: { pubDate: "desc" },
        take: 30,
        select: articleSelect,
      })
      articles.push(...fallback)
    }

    const start = Date.now()
    const model = process.env.OLLAMA_DIGEST_MODEL || "llama3"
    const promptPreview = articles
      .map((article) => `${article.topic}: ${article.title}`)
      .join("\n")
      .slice(0, 200)
    let content: string
    try {
      content = await generateDigest(articles)
    } catch (error) {
      console.error("[AI digest unavailable]:", error)
      await logAiAction({
        action: "digest",
        model,
        prompt: promptPreview,
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

    await prisma.dailyDigest.upsert({
      where: { date: digestKey },
      update: { content, model },
      create: { date: digestKey, content, model },
    })

    await logAiAction({
      action: "digest",
      model,
      prompt: promptPreview,
      tokens: null,
      ms,
      success: true,
    })

    return NextResponse.json({
      digest: content,
      date: digestKey,
      cached: false,
      model,
    })
  } catch (error) {
    console.error("[ai digest] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const userId = await getMutableCurrentUserId()
  const digestKey = getDigestKey(today, userId)

  await prisma.dailyDigest.deleteMany({ where: { date: digestKey } })
  return NextResponse.json({
    success: true,
    message: "Digest cleared - regenerate by calling GET",
  })
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUserId } from "@/lib/auth"
import { getClientIp, checkRateLimit } from "@/lib/rateLimit"
import { runGeneralChat, sanitizeMessages } from "@/lib/ai/run-general-chat"

export const maxDuration = 60

const VALID_TOPICS = new Set([
  "all",
  "world",
  "technology",
  "india",
  "business",
  "science",
  "sports",
  "health",
  "climate",
  "politics",
])

export async function POST(request: Request) {
  const rate = checkRateLimit(`chat:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 60_000,
  })

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      }
    )
  }

  try {
    const body = await request.json()
    const inputText = body.text ?? body.message ?? (body.messages ? JSON.stringify(body.messages) : "");
    if (inputText.length > 2000) {
      return NextResponse.json(
        { error: "Input too large." },
        { status: 413 }
      );
    }
    
    const rawTopic = body.topic
    const topic =
      typeof rawTopic === "string" && VALID_TOPICS.has(rawTopic.toLowerCase())
        ? rawTopic.toLowerCase()
        : "all"

    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sanitizedMessages = sanitizeMessages(body.messages)
    if (sanitizedMessages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    let followedTopics: string[] = []
    if (userId) {
      const follows = await prisma.userTopicFollow.findMany({
        where: { userId },
        select: { topicSlug: true },
      })
      followedTopics = follows.map((follow) => follow.topicSlug)
    }

    return await runGeneralChat({
      messages: sanitizedMessages,
      topicBias: topic,
      userId,
      followedTopics
    })

  } catch (error) {
    console.error("[ai chat] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

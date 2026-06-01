import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { MODELS, structuredChat } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { id, title, description, topic } = await request.json()

    if (!id || !title) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const existing = await prisma.newsArticle.findUnique({
      where: { id },
      select: { aiTags: true },
    })

    if (existing?.aiTags) {
      return NextResponse.json({
        tags: JSON.parse(existing.aiTags),
        cached: true,
      })
    }

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
      return NextResponse.json(
        { error: "AI service unavailable", fallback: true },
        { status: 503 }
      )
    }
    const ms = Date.now() - start

    await prisma.newsArticle.update({
      where: { id },
      data: {
        aiTags: JSON.stringify(response.tags),
        aiProcessed: true,
      },
    })

    // Log action
    await prisma.aiLog.create({
      data: {
        action: "tag",
        model: MODELS.FAST,
        prompt: title.substring(0, 100),
        ms,
      }
    })

    return NextResponse.json({ tags: response.tags, cached: false })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

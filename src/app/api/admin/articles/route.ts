import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const topic = searchParams.get("topic")
  const confirm = searchParams.get("confirm")

  try {
    if (id) {
      await prisma.newsArticle.delete({ where: { id } })
      return NextResponse.json({ success: true, deleted: 1 })
    }

    if (topic && topic !== "all") {
      const result = await prisma.newsArticle.deleteMany({
        where: { topic },
      })
      return NextResponse.json({ success: true, deleted: result.count })
    }

    if (confirm !== "true") {
      return NextResponse.json(
        { success: false, error: "Missing id, topic, or confirm=true" },
        { status: 400 }
      )
    }

    const result = await prisma.newsArticle.deleteMany({})
    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

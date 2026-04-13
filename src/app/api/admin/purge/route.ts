import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get("days") || "3")

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const result = await prisma.newsArticle.deleteMany({
      where: { pubDate: { lt: cutoff } },
    })
    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

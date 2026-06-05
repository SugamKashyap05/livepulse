import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ articles: [] })
  }

  const articles = await prisma.newsArticle.findMany({
    where: {
      published: true,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { source: { contains: q, mode: "insensitive" } },
        { topic: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { pubDate: "desc" },
    take: 50,
  })

  return NextResponse.json({ articles })
}

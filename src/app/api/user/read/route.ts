import { NextResponse } from "next/server"
import { getMutableCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const userId = await getMutableCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { articleId } = await req.json()
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 })
  }

  await prisma.userArticleRead.upsert({
    where: {
      userId_articleId: {
        userId,
        articleId,
      },
    },
    create: { userId, articleId },
    update: {},
  })

  return NextResponse.json({ success: true })
}

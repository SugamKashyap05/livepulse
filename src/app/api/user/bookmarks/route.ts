import { NextResponse } from "next/server"
import { getMutableCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const userId = await getMutableCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const bookmarks = await prisma.userBookmark.findMany({
    where: { userId },
    include: { article: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(bookmarks.map((bookmark) => bookmark.article))
}

export async function POST(req: Request) {
  const userId = await getMutableCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { articleId } = await req.json()
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 })
  }

  await prisma.userBookmark.upsert({
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

export async function DELETE(req: Request) {
  const userId = await getMutableCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { articleId } = await req.json()
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 })
  }

  await prisma.userBookmark.deleteMany({
    where: { userId, articleId },
  })

  return NextResponse.json({ success: true })
}

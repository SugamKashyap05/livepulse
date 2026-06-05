import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isAdminAuthorized } from "@/lib/adminAuth"

export async function DELETE(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const article = await prisma.newsArticle.findFirst({
      where: { id, aiGenerated: true, published: false },
    })

    if (!article) {
      return NextResponse.json(
        { error: "Draft not found or already published" },
        { status: 404 }
      )
    }

    await prisma.newsArticle.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

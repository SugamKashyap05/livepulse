import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { createAdminActionEvent } from "@/lib/adminDepartments"
import { recordAdminAuditLog } from "@/lib/adminAudit"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const article = await prisma.newsArticle.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        published: true,
        aiGenerated: true,
      },
    })
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    const updated = await prisma.newsArticle.update({
      where: { id },
      data: { published: false },
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        published: true,
        aiGenerated: true,
      },
    })

    await recordAdminAuditLog({
      action: "unpublish",
      targetType: "article",
      targetId: article.id,
      before: article,
      after: updated,
      metadata: {
        route: "/api/admin/ai/unpublish",
        department: "publishing",
      },
    })

    await createAdminActionEvent({
      department: "publishing",
      action: "unpublish",
      title: "Article unpublished",
      body: article.title,
      severity: "warning",
      articleId: article.id,
      metadata: {
        targetType: "article",
        topic: article.topic,
        source: article.source,
        previousPublished: article.published,
        published: false,
        aiGenerated: article.aiGenerated,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[api/admin/ai/unpublish] error:", e)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

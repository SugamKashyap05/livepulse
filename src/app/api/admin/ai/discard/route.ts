import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { createAdminActionEvent } from "@/lib/adminDepartments"
import { recordAdminAuditLog } from "@/lib/adminAudit"

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
    await recordAdminAuditLog({
      action: "discard",
      targetType: "article",
      targetId: article.id,
      before: {
        id: article.id,
        title: article.title,
        topic: article.topic,
        source: article.source,
        published: article.published,
        aiGenerated: article.aiGenerated,
      },
      after: { deleted: true },
      metadata: {
        route: "/api/admin/ai/discard",
        department: "publishing",
      },
    })
    await createAdminActionEvent({
      department: "publishing",
      action: "discard",
      title: "Draft discarded",
      body: article.title,
      severity: "warning",
      articleId: article.id,
      metadata: {
        targetType: "article",
        topic: article.topic,
        source: article.source,
        published: article.published,
        aiGenerated: article.aiGenerated,
      },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[api/admin/ai/discard] error:", e)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

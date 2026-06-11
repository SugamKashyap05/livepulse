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
      data: { published: true },
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
      action: "publish",
      targetType: "article",
      targetId: article.id,
      before: article,
      after: updated,
      metadata: {
        route: "/api/admin/ai/publish",
        department: "publishing",
      },
    })

    await createAdminActionEvent({
      department: "publishing",
      action: "publish",
      title: "Article published",
      body: article.title,
      severity: "success",
      articleId: article.id,
      metadata: {
        targetType: "article",
        topic: article.topic,
        source: article.source,
        previousPublished: article.published,
        published: true,
        aiGenerated: article.aiGenerated,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[api/admin/ai/publish] error:", e)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

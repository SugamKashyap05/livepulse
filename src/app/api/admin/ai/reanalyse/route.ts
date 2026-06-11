import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { runFactChecker, runSpinDoctor } from "@/lib/agents"
import { createAdminActionEvent } from "@/lib/adminDepartments"
import { recordAdminAuditLog } from "@/lib/adminAudit"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let articleId: string | null = null

  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    articleId = id

    const article = await prisma.newsArticle.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        published: true,
        aiGenerated: true,
        factScore: true,
        biasAnalysis: true,
        agentNotes: true,
      },
    })
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    await createAdminActionEvent({
      department: "verification",
      action: "reanalyse",
      title: "Article reanalysis started",
      body: article.title,
      severity: "info",
      articleId: article.id,
      notify: false,
      metadata: {
        targetType: "article",
        topic: article.topic,
        source: article.source,
        published: article.published,
        aiGenerated: article.aiGenerated,
        phase: "fact_check",
      },
    })

    await runFactChecker(id)
    await runSpinDoctor(id)

    const updated = await prisma.newsArticle.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        topic: true,
        source: true,
        published: true,
        aiGenerated: true,
        factScore: true,
        biasAnalysis: true,
        agentNotes: true,
      },
    })

    await recordAdminAuditLog({
      action: "reanalyse",
      targetType: "article",
      targetId: article.id,
      before: article,
      after: updated,
      metadata: {
        route: "/api/admin/ai/reanalyse",
        department: "verification",
      },
    })

    await createAdminActionEvent({
      department: "verification",
      action: "reanalyse",
      title: "Article reanalysis completed",
      body: article.title,
      severity: "success",
      articleId: article.id,
      metadata: {
        targetType: "article",
        topic: article.topic,
        source: article.source,
        published: article.published,
        aiGenerated: article.aiGenerated,
        factScore: updated?.factScore ?? null,
        hasBiasAnalysis: Boolean(updated?.biasAnalysis),
        phase: "completed",
      },
    })

    return NextResponse.json({ success: true, ...updated })
  } catch (e) {
    console.error("[api/admin/ai/reanalyse] error:", e)
    if (articleId) {
      await recordAdminAuditLog({
        action: "reanalyse_failed",
        targetType: "article",
        targetId: articleId,
        before: null,
        after: {
          error: e instanceof Error ? e.message : "Unknown error",
        },
        metadata: {
          route: "/api/admin/ai/reanalyse",
          department: "verification",
        },
      }).catch(() => {})
      await createAdminActionEvent({
        department: "verification",
        action: "reanalyse",
        title: "Article reanalysis failed",
        body: e instanceof Error ? e.message : "Unknown error",
        severity: "error",
        articleId,
        needsEditorReview: true,
        metadata: {
          targetType: "article",
          error: e instanceof Error ? e.message.slice(0, 300) : "Unknown error",
        },
      }).catch(() => {})
    }
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

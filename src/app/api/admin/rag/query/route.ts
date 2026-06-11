import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { createAdminActionEvent } from "@/lib/adminDepartments"
import { buildRetrievedContext, searchRagContext } from "@/lib/rag"

export const dynamic = "force-dynamic"

function parseLimit(value: unknown) {
  const parsed =
    typeof value === "number" ? value : parseInt(String(value ?? "8"), 10)
  return Number.isNaN(parsed) ? 8 : Math.min(Math.max(parsed, 1), 20)
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let query = ""

  try {
    const body = await request.json().catch(() => ({}))
    query =
      typeof (body as { query?: unknown }).query === "string"
        ? String((body as { query?: unknown }).query).trim().slice(0, 500)
        : ""
    const topicSlug =
      typeof (body as { topic?: unknown }).topic === "string"
        ? String((body as { topic?: unknown }).topic).trim().toLowerCase()
        : null
    const articleId =
      typeof (body as { articleId?: unknown }).articleId === "string"
        ? String((body as { articleId?: unknown }).articleId).trim()
        : null
    const limit = parseLimit((body as { limit?: unknown }).limit)

    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 })
    }

    const result = await searchRagContext({
      query,
      topicSlug,
      articleId,
      limit,
    })

    const citedArticleIds = Array.from(
      new Set(result.chunks.map((chunk) => chunk.articleId))
    )
    const sources = Array.from(new Set(result.chunks.map((chunk) => chunk.source)))

    await createAdminActionEvent({
      department: "research",
      action: "rag_query",
      title: "RAG query tested",
      body:
        result.chunks.length > 0
          ? `Retrieved ${result.chunks.length} chunks from ${citedArticleIds.length} articles.`
          : `No RAG chunks retrieved${result.fallbackReason ? `: ${result.fallbackReason}` : "."}`,
      severity: result.chunks.length > 0 ? "success" : "warning",
      notify: false,
      metadata: {
        targetType: "rag_query",
        query,
        topic: topicSlug,
        articleId: articleId ?? undefined,
        limit,
        retrievedChunks: result.chunks.length,
        citedArticleIds,
        sources,
        rag: result.rag,
        fallbackReason: result.fallbackReason,
      },
    })

    return NextResponse.json({
      success: true,
      query,
      topic: topicSlug,
      articleId,
      limit,
      rag: result.rag,
      fallbackReason: result.fallbackReason,
      stats: {
        retrievedChunks: result.chunks.length,
        citedArticles: citedArticleIds.length,
        sources,
      },
      chunks: result.chunks.map((chunk) => ({
        id: chunk.id,
        articleId: chunk.articleId,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        source: chunk.source,
        topic: chunk.topic,
        pubDate: chunk.pubDate,
        distance: chunk.distance,
        content: chunk.content,
      })),
      context: buildRetrievedContext(result.chunks),
    })
  } catch (error) {
    console.error("[api/admin/rag/query] error:", error)
    await createAdminActionEvent({
      department: "research",
      action: "rag_query",
      title: "RAG query failed",
      body: error instanceof Error ? error.message : "Unknown error",
      severity: "error",
      needsEditorReview: true,
      notify: true,
      metadata: {
        targetType: "rag_query",
        query,
        error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      },
    }).catch(() => {})
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import {
  EMBEDDING_MODEL,
  logAiAction,
  AI_PROVIDER,
} from "@/lib/ollama"
import {
  clearEmbeddingModel,
  indexAllMissingArticles,
  indexAllPublishedArticles,
  indexArticle,
  indexMissingArticles,
  indexRecentArticles,
} from "@/lib/rag"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type ReindexMode = "missing" | "recent" | "article" | "all"

function parseLimit(value: unknown) {
  const parsed = typeof value === "number"
    ? value
    : parseInt(String(value ?? "20"), 10)
  return Number.isNaN(parsed)
    ? 20
    : Math.min(Math.max(parsed, 1), 100)
}

function parseMode(value: unknown): ReindexMode {
  return value === "recent" || value === "article" || value === "all"
    ? value
    : "missing"
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()

  try {
    const body = await request.json().catch(() => ({}))
    const mode = parseMode((body as { mode?: unknown }).mode)
    const articleId = (body as { articleId?: unknown }).articleId
    const limit = parseLimit((body as { limit?: unknown }).limit)
    const indexAllMissing = (body as { all?: unknown }).all === true

    await logAiAction({
      action: "rag-reindex",
      model: EMBEDDING_MODEL,
      provider: AI_PROVIDER,
      success: true,
    }).catch(() => {})

    let result: unknown

    if (mode === "article") {
      if (typeof articleId !== "string" || !articleId) {
        return NextResponse.json(
          { error: "articleId required" },
          { status: 400 }
        )
      }
      result = await indexArticle(articleId)
    } else if (mode === "recent") {
      result = await indexRecentArticles(limit)
    } else if (mode === "all") {
      await clearEmbeddingModel(EMBEDDING_MODEL)
      result = await indexAllPublishedArticles()
    } else if (indexAllMissing) {
      result = await indexAllMissingArticles()
    } else {
      result = await indexMissingArticles(limit)
    }

    await logAiAction({
      action: "rag-reindex",
      model: EMBEDDING_MODEL,
      provider: AI_PROVIDER,
      durationMs: Date.now() - startedAt,
      success: true,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      mode,
      limit: mode === "all" || indexAllMissing ? null : limit,
      result,
    })
  } catch (error) {
    console.error("[api/admin/rag/reindex] error:", error)
    await logAiAction({
      action: "rag-reindex",
      model: EMBEDDING_MODEL,
      provider: AI_PROVIDER,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {})
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

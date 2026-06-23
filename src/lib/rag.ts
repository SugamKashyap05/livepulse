import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedText } from "@/lib/ollama"
import { sanitizeAiText } from "@/lib/textSafety"

type IndexableArticle = {
  id: string
  title: string
  description: string | null
  source: string
  topic: string
  pubDate: Date
  summary: string | null
  aiTags: string | null
  factScore: number | null
  biasAnalysis: string | null
  published: boolean
}

export type RagChunk = {
  id: string
  articleId: string
  chunkIndex: number
  content: string
  topic: string
  source: string
  pubDate: Date
  title: string
  link: string
  distance: number
}

export type RagSearchResult = {
  chunks: RagChunk[]
  rag: boolean
  fallbackReason?: string
}

export type RagContextStats = {
  retrievedChunks: number
  citedArticles: number
  rag: boolean
  fallbackReason?: string
  citedSources: string[]
}

const MAX_CHUNK_CHARS = 900
const MAX_CONTEXT_CHARS = 12_000
const DEFAULT_LIMIT = 8

function getArticleContentHash(article: Pick<
  IndexableArticle,
  "title" | "description" | "summary" | "aiTags" | "factScore"
>) {
  return crypto
    .createHash("sha256")
    .update(article.title)
    .update(article.description ?? "")
    .update(article.summary ?? "")
    .update(article.aiTags ?? "")
    .update(String(article.factScore ?? ""))
    .digest("hex")
}

function normalizeVectorLiteral(vector: number[]) {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`
}

function splitIntoChunks(content: string) {
  const chunks: string[] = []
  let cursor = 0
  const overlap = 120

  while (cursor < content.length) {
    const end = Math.min(cursor + MAX_CHUNK_CHARS, content.length)
    chunks.push(content.slice(cursor, end))
    if (end === content.length) break
    cursor = Math.max(0, end - overlap)
  }

  return chunks
}

export function buildArticleChunks(article: IndexableArticle) {
  if (!article.published) return []

  const tags = article.aiTags ? sanitizeAiText(article.aiTags, 300) : ""
  const parts = [
    `Title: ${sanitizeAiText(article.title, 300)}`,
    `Source: ${sanitizeAiText(article.source, 120)}`,
    `Topic: ${sanitizeAiText(article.topic, 80)}`,
    `Published: ${article.pubDate.toISOString()}`,
    article.description ? `Description: ${sanitizeAiText(article.description, 1200)}` : "",
    article.summary ? `AI Summary: ${sanitizeAiText(article.summary, 1200)}` : "",
    tags ? `Tags: ${tags}` : "",
    article.factScore !== null ? `Fact Score: ${article.factScore}/100` : "",
    article.biasAnalysis ? `Bias Analysis: ${sanitizeAiText(article.biasAnalysis, 600)}` : "",
  ].filter(Boolean)

  return splitIntoChunks(parts.join("\n"))
}

export async function indexArticle(articleId: string) {
  const article = await prisma.newsArticle.findFirst({
    where: { id: articleId, published: true },
    select: {
      id: true,
      title: true,
      description: true,
      source: true,
      topic: true,
      pubDate: true,
      summary: true,
      aiTags: true,
      factScore: true,
      biasAnalysis: true,
      published: true,
    },
  })

  if (!article) return { indexed: 0, skipped: true }

  const contentHash = getArticleContentHash(article)
  const existing = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "ArticleEmbedding"
    WHERE "articleId" = ${article.id}
      AND "contentHash" = ${contentHash}
      AND "embeddingModel" = ${EMBEDDING_MODEL}
      AND "embeddingDim" = ${EMBEDDING_DIM}
  `

  if (Number(existing[0]?.count ?? 0) > 0) {
    return { indexed: 0, skipped: true }
  }

  await prisma.$executeRaw`
    DELETE FROM "ArticleEmbedding"
    WHERE "articleId" = ${article.id}
      AND "embeddingModel" = ${EMBEDDING_MODEL}
  `

  const chunks = buildArticleChunks(article)

  for (let index = 0; index < chunks.length; index++) {
    const content = chunks[index]
    const vector = await embedText(content, "passage")
    const vectorLiteral = normalizeVectorLiteral(vector)

    await prisma.$executeRaw`
      INSERT INTO "ArticleEmbedding" (
        "id",
        "articleId",
        "chunkIndex",
        "content",
        "contentHash",
        "embedding",
        "embeddingModel",
        "embeddingDim",
        "topic",
        "source",
        "pubDate",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${article.id},
        ${index},
        ${content},
        ${contentHash},
        ${vectorLiteral}::vector,
        ${EMBEDDING_MODEL},
        ${EMBEDDING_DIM},
        ${article.topic},
        ${article.source},
        ${article.pubDate},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("articleId", "chunkIndex", "embeddingModel")
      DO UPDATE SET
        "content" = EXCLUDED."content",
        "contentHash" = EXCLUDED."contentHash",
        "embedding" = EXCLUDED."embedding",
        "embeddingDim" = EXCLUDED."embeddingDim",
        "topic" = EXCLUDED."topic",
        "source" = EXCLUDED."source",
        "pubDate" = EXCLUDED."pubDate",
        "updatedAt" = CURRENT_TIMESTAMP
    `
  }

  return { indexed: chunks.length, skipped: false }
}

export async function indexRecentArticles(limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const articles = await prisma.newsArticle.findMany({
    where: { published: true },
    orderBy: { fetchedAt: "desc" },
    take: safeLimit,
    select: { id: true },
  })

  let indexed = 0
  let skipped = 0

  for (const article of articles) {
    const result = await indexArticle(article.id)
    indexed += result.indexed
    if (result.skipped) skipped++
  }

  return { articles: articles.length, indexed, skipped }
}

export async function indexAllPublishedArticles() {
  const articles = await prisma.newsArticle.findMany({
    where: { published: true },
    orderBy: { fetchedAt: "desc" },
    select: { id: true },
  })

  let indexed = 0
  let skipped = 0

  for (const article of articles) {
    const result = await indexArticle(article.id)
    indexed += result.indexed
    if (result.skipped) skipped++
  }

  return { articles: articles.length, indexed, skipped }
}

export async function indexMissingArticles(limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT a."id"
    FROM "NewsArticle" a
    LEFT JOIN "ArticleEmbedding" e
      ON e."articleId" = a."id"
      AND e."embeddingModel" = ${EMBEDDING_MODEL}
    WHERE a."published" = true
      AND e."id" IS NULL
    ORDER BY a."fetchedAt" DESC
    LIMIT ${safeLimit}
  `

  let indexed = 0
  let skipped = 0

  for (const row of rows) {
    const result = await indexArticle(row.id)
    indexed += result.indexed
    if (result.skipped) skipped++
  }

  return { articles: rows.length, indexed, skipped }
}

export async function indexAllMissingArticles() {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT a."id"
    FROM "NewsArticle" a
    LEFT JOIN "ArticleEmbedding" e
      ON e."articleId" = a."id"
      AND e."embeddingModel" = ${EMBEDDING_MODEL}
    WHERE a."published" = true
      AND e."id" IS NULL
    ORDER BY a."fetchedAt" DESC
  `

  let indexed = 0
  let skipped = 0

  for (const row of rows) {
    const result = await indexArticle(row.id)
    indexed += result.indexed
    if (result.skipped) skipped++
  }

  return { articles: rows.length, indexed, skipped }
}

export async function clearEmbeddingModel(model: string) {
  await prisma.$executeRaw`
    DELETE FROM "ArticleEmbedding"
    WHERE "embeddingModel" = ${model}
  `
}

export async function searchRagContext({
  query,
  topicSlug,
  articleId,
  limit = DEFAULT_LIMIT,
}: {
  query: string
  topicSlug?: string | null
  articleId?: string | null
  userId?: string | null
  limit?: number
}): Promise<RagSearchResult> {
  const sanitizedQuery = sanitizeAiText(query, 500)
  if (!sanitizedQuery) {
    return { chunks: [], rag: false, fallbackReason: "empty_query" }
  }

  let vector: number[]
  try {
    vector = await embedText(sanitizedQuery, "query")
  } catch {
    return { chunks: [], rag: false, fallbackReason: "embed_unavailable" }
  }

  const vectorLiteral = normalizeVectorLiteral(vector)
  const fetchLimit = Math.max(limit * 2, 16)
  const topicFilter = topicSlug && topicSlug !== "all" ? topicSlug : null
  const rawResults = await prisma.$queryRaw<RagChunk[]>`
    SELECT
      e."id",
      e."articleId",
      e."chunkIndex",
      e."content",
      e."topic",
      e."source",
      e."pubDate",
      a."title",
      a."link",
      e."embedding" <=> ${vectorLiteral}::vector AS "distance"
    FROM "ArticleEmbedding" e
    INNER JOIN "NewsArticle" a ON a."id" = e."articleId"
    WHERE a."published" = true
      AND e."embeddingModel" = ${EMBEDDING_MODEL}
      AND e."embeddingDim" = ${EMBEDDING_DIM}
      AND (${topicFilter}::text IS NULL OR e."topic" = ${topicFilter})
      AND (${articleId}::text IS NULL OR e."articleId" <> ${articleId})
    ORDER BY e."embedding" <=> ${vectorLiteral}::vector ASC
    LIMIT ${fetchLimit}
  `

  const seen = new Set<string>()
  const chunks: RagChunk[] = []
  let contextChars = 0

  for (const chunk of rawResults) {
    if (seen.has(chunk.articleId)) continue
    const content = chunk.content.slice(0, MAX_CHUNK_CHARS)
    if (contextChars + content.length > MAX_CONTEXT_CHARS) break

    seen.add(chunk.articleId)
    chunks.push({
      ...chunk,
      content,
    })
    contextChars += content.length
    if (chunks.length >= limit) break
  }

  return { chunks, rag: true }
}

export function buildRetrievedContext(chunks: RagChunk[]) {
  if (chunks.length === 0) return ""

  const body = chunks
    .map(
      (chunk, index) =>
        `[CHUNK ${index + 1} - SOURCE: ${chunk.source} - TOPIC: ${chunk.topic}]\n${chunk.content}`
    )
    .join("\n\n")

  return `<retrieved_context>\n${body}\n</retrieved_context>`
}

export function extractCitedSources(reply: string) {
  return Array.from(
    new Set(
      reply
        .match(/\[([^\]]+)\]/g)
        ?.map((source) => source.slice(1, -1).trim())
        .filter(Boolean) ?? []
    )
  )
}

export async function getRagStatus() {
  const [totalPublished, embeddedRows, chunkRows, latest, latestAiLog] =
    await Promise.all([
      prisma.newsArticle.count({ where: { published: true } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT "articleId")::bigint AS count
        FROM "ArticleEmbedding"
        WHERE "embeddingModel" = ${EMBEDDING_MODEL}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "ArticleEmbedding"
        WHERE "embeddingModel" = ${EMBEDDING_MODEL}
      `,
      prisma.$queryRaw<{ updatedAt: Date }[]>`
        SELECT "updatedAt"
        FROM "ArticleEmbedding"
        WHERE "embeddingModel" = ${EMBEDDING_MODEL}
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `,
      prisma.aiLog.findFirst({
        where: { action: { in: ["rag-reindex", "embed"] } },
        orderBy: { createdAt: "desc" },
        select: { success: true, error: true },
      }),
    ])

  const embedded = Number(embeddedRows[0]?.count ?? 0)
  const chunks = Number(chunkRows[0]?.count ?? 0)

  return {
    totalPublished,
    embedded,
    chunks,
    coverage: totalPublished > 0
      ? Math.round((embedded / totalPublished) * 100)
      : 0,
    embeddingModel: EMBEDDING_MODEL,
    lastIndexed: latest[0]?.updatedAt?.toISOString() ?? null,
    lastError: latestAiLog && !latestAiLog.success
      ? latestAiLog.error
      : null,
  }
}

export function toPrismaArticleWhere(
  topicSlug?: string | null,
  followedTopics: string[] = []
): Prisma.NewsArticleWhereInput {
  if (topicSlug && topicSlug !== "all") {
    return { published: true, topic: topicSlug }
  }

  if (followedTopics.length > 0) {
    return { published: true, topic: { in: followedTopics } }
  }

  return { published: true }
}

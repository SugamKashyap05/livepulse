import { prisma } from "@/lib/db"
import AiManagerClient from "@/components/admin/AiManagerClient"
import RagAdminPanel from "@/components/admin/RagAdminPanel"
import { MODELS } from "@/lib/ollama"
import { getRagStatus } from "@/lib/rag"
import { getDepartmentSummaries } from "@/lib/adminDepartments"

export const dynamic = "force-dynamic"

function normalizeManagerMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const actionCards = (metadata as { actionCards?: unknown }).actionCards
  if (!Array.isArray(actionCards)) return metadata as Record<string, unknown>

  return {
    ...(metadata as Record<string, unknown>),
    actionCards: actionCards
      .filter(
        (card): card is Record<string, unknown> =>
          card !== null && typeof card === "object" && !Array.isArray(card)
      )
      .map((card) => ({
        jobType: card.jobType,
        label: card.label,
        params:
          card.params && typeof card.params === "object" && !Array.isArray(card.params)
            ? card.params
            : {},
        confirmLabel: card.confirmLabel,
      }))
      .filter(
        (card) =>
          typeof card.jobType === "string" &&
          typeof card.label === "string" &&
          typeof card.confirmLabel === "string"
      ),
  }
}

function isManagerMessageVisible(message: {
  role: string
  jobId: string | null
  metadata: unknown
}) {
  if (message.jobId) return false
  if (message.role !== "user" && message.role !== "assistant") return false
  if (!message.metadata || typeof message.metadata !== "object" || Array.isArray(message.metadata)) {
    return true
  }

  const metadata = message.metadata as {
    event?: unknown
    source?: unknown
    type?: unknown
  }
  const event = typeof metadata.event === "string" ? metadata.event : ""
  const source = typeof metadata.source === "string" ? metadata.source : ""
  const type = typeof metadata.type === "string" ? metadata.type : ""

  return !(
    event.startsWith("job_") ||
    event.startsWith("job.") ||
    source === "job" ||
    source === "department" ||
    source === "notification" ||
    source === "system" ||
    type === "job_failure"
  )
}

export default async function AiManagerPage() {
  const [
    totalArticles,
    processed,
    withSentiment,
    withSummary,
    withTags,
    topicTotals,
  ] = await Promise.all([
    prisma.newsArticle.count(),
    prisma.newsArticle.count({ where: { aiProcessed: true } }),
    prisma.newsArticle.count({ where: { sentiment: { not: null } } }),
    prisma.newsArticle.count({ where: { summary: { not: null } } }),
    prisma.newsArticle.count({ where: { aiTags: { not: null } } }),
    prisma.newsArticle.groupBy({
      by: ["topic"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    }),
  ])

  const coverageByTopic = await Promise.all(
    topicTotals.map(async (topic) => {
      const where = { topic: topic.topic }
      const [summaries, tags, sentiment, ragIndexed] = await Promise.all([
        prisma.newsArticle.count({
          where: { ...where, summary: { not: null } },
        }),
        prisma.newsArticle.count({
          where: { ...where, aiTags: { not: null } },
        }),
        prisma.newsArticle.count({
          where: { ...where, sentiment: { not: null } },
        }),
        prisma.articleEmbedding
          .groupBy({
            by: ["articleId"],
            where: { topic: topic.topic },
            _count: { articleId: true },
          })
          .then((rows) => rows.length),
      ])

      return {
        topic: topic.topic,
        total: topic._count.id,
        missingSummary: Math.max(0, topic._count.id - summaries),
        missingTags: Math.max(0, topic._count.id - tags),
        missingSentiment: Math.max(0, topic._count.id - sentiment),
        ragIndexed,
      }
    })
  )

  const logs = await prisma.aiLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const digests = await prisma.dailyDigest.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  })
  const managerMessages = (
    await prisma.managerChatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        jobId: true,
        createdAt: true,
      },
    })
  ).filter(isManagerMessageVisible).reverse()
  const [ragStatus, departmentSummaries, editorInbox] = await Promise.all([
    getRagStatus(),
    getDepartmentSummaries(),
    prisma.adminDepartmentEvent.findMany({
      where: {
        needsEditorReview: true,
        status: { notIn: ["resolved", "archived"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ])

  const serializedLogs = logs.map((l: { id: string; action: string; model: string; prompt: string | null; tokens: number | null; ms: number | null; success: boolean; error: string | null; createdAt: Date }) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }))

  const serializedDigests = digests.map((d: { id: string; date: string; content: string; model: string | null; createdAt: Date }) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }))
  const serializedManagerMessages = managerMessages.map((message) => ({
    ...message,
    metadata: normalizeManagerMetadata(message.metadata),
    createdAt: message.createdAt.toISOString(),
  }))
  const serializedDepartmentSummaries = departmentSummaries.map((department) => ({
    ...department,
    latestEvents: department.latestEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
      readAt: event.readAt?.toISOString() ?? null,
      resolvedAt: event.resolvedAt?.toISOString() ?? null,
    })),
  }))
  const serializedEditorInbox = editorInbox.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
    readAt: event.readAt?.toISOString() ?? null,
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
  }))
  const coverage = totalArticles > 0
    ? Math.round((processed / totalArticles) * 100)
    : 0

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          AI Manager Office
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          Private newsroom control plane for agents, departments, jobs, and publishing
        </p>
      </div>

      {/* AI Coverage stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 28,
      }}>
        {[
          { label: "Total Articles", value: totalArticles, color: "var(--text)" },
          { label: "AI Tagged", value: withTags, color: "#6c8fff" },
          { label: "Sentiment Done", value: withSentiment, color: "#4af0c4" },
          { label: "Summarized", value: withSummary, color: "#a78bfa" },
          { label: "Coverage", value: `${coverage}%`, color: "#f5c542" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "16px",
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 8,
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 26,
              fontWeight: 700,
              color: s.color,
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <RagAdminPanel initialStatus={ragStatus} />

      <AiManagerClient
        logs={serializedLogs}
        digests={serializedDigests}
        models={MODELS}
        initialMessages={serializedManagerMessages}
        coverageByTopic={coverageByTopic}
        departmentSummaries={serializedDepartmentSummaries}
        editorInbox={serializedEditorInbox}
      />
    </div>
  )
}

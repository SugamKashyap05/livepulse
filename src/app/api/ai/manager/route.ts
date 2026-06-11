import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import {
  MODELS,
  OllamaMessage,
  logAiAction,
  ollamaChatStream,
} from "@/lib/ollama"
import {
  buildAdminAiActionCards,
  type AdminAiActionCard,
  type AdminAiJobType,
} from "@/lib/adminAiJobs"
import { getRagStatus } from "@/lib/rag"
import { getDepartmentSummaries } from "@/lib/adminDepartments"

export const maxDuration = 60

const LEGACY_SESSION_ID = "legacy-main-editor"

function sendSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  data: Record<string, unknown>
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

const actionPattern = /\[ACTION:\s*(\w+)\s*\|\s*([^|]+)\s*\|\s*(\{[^}]*\})\]/g

function parseActionCards(reply: string): AdminAiActionCard[] {
  const cards: AdminAiActionCard[] = []
  let match: RegExpExecArray | null

  while ((match = actionPattern.exec(reply)) !== null) {
    try {
      const jobType = match[1].trim() as AdminAiJobType
      const label = match[2].trim()
      const params = JSON.parse(match[3].trim()) as Record<string, unknown>
      cards.push({
        jobType,
        label,
        params,
        confirmLabel: label,
      })
    } catch {
      // Malformed action marker; skip it.
    }
  }

  return cards
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isJobOrSystemMetadata(metadata: unknown) {
  const record = asRecord(metadata)
  const event = typeof record.event === "string" ? record.event : ""
  const source = typeof record.source === "string" ? record.source : ""
  const type = typeof record.type === "string" ? record.type : ""

  return (
    event.startsWith("job_") ||
    event.startsWith("job.") ||
    event.startsWith("task") ||
    event.startsWith("system") ||
    source === "job" ||
    source === "department" ||
    source === "notification" ||
    source === "system" ||
    type === "job_failure"
  )
}

function isMissingEditorSchema(error: unknown) {
  const record = asRecord(error)
  const code = record.code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("EditorSession") ||
    message.includes("EditorMessage") ||
    message.includes("EditorContextRef")
  )
}

function boundedHistory(
  messages: { role: "user" | "assistant"; content: string }[],
  maxMessages = 20,
  maxChars = 12000
) {
  const selected: { role: "user" | "assistant"; content: string }[] = []
  let used = 0

  for (const message of [...messages].slice(-maxMessages).reverse()) {
    const content = message.content.slice(0, 1600)
    if (used + content.length > maxChars && selected.length > 0) break
    selected.unshift({ role: message.role, content })
    used += content.length
  }

  return selected
}

function editorContextTarget(editorContext: Record<string, unknown>) {
  const eventId = typeof editorContext.eventId === "string" ? editorContext.eventId : null
  const jobId = typeof editorContext.jobId === "string" ? editorContext.jobId : null
  const articleId = typeof editorContext.articleId === "string" ? editorContext.articleId : null
  const departmentId =
    typeof editorContext.departmentId === "string" ? editorContext.departmentId : null

  return {
    type: eventId ? "department_event" : jobId ? "job" : articleId ? "article" : "snapshot",
    targetId: eventId ?? jobId ?? articleId ?? departmentId ?? "main-editor-context",
    departmentEventId: eventId,
    jobId,
    articleId,
    department: departmentId,
    label:
      typeof editorContext.title === "string"
        ? editorContext.title.slice(0, 160)
        : "Main Editor context snapshot",
  }
}

function buildMemorySummary(messages: { role: string; content: string }[]) {
  const userLines = messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.content.replace(/\s+/g, " ").slice(0, 180))
  if (userLines.length === 0) return "No durable editor preferences extracted yet."
  return `Recent editor focus: ${userLines.join(" | ")}`
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, sessionId: rawSessionId, editorContext: rawEditorContext } =
      await request.json()
    const sessionId =
      typeof rawSessionId === "string" && rawSessionId.trim()
        ? rawSessionId.trim().slice(0, 120)
        : LEGACY_SESSION_ID
    const editorContext = asRecord(rawEditorContext)
    const safeMessages: OllamaMessage[] = Array.isArray(messages)
      ? messages
          .filter(
            (message): message is OllamaMessage =>
              message &&
              typeof message === "object" &&
              ((message as OllamaMessage).role === "user" ||
                (message as OllamaMessage).role === "assistant") &&
              typeof (message as OllamaMessage).content === "string"
          )
          .map((message) => ({
            role: message.role,
            content: message.content.slice(0, 4000),
          }))
      : []
    const latestUserMessage =
      [...safeMessages].reverse().find((message) => message.role === "user")
        ?.content ?? ""

    let realEditorSession = false
    let sessionMemorySummary = ""
    let pinnedContextSummary = "None"

    if (sessionId !== LEGACY_SESSION_ID) {
      try {
        const session = await prisma.editorSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            metadata: true,
            contextRefs: {
              orderBy: { updatedAt: "desc" },
              take: 5,
              select: {
                type: true,
                targetId: true,
                label: true,
                department: true,
                jobId: true,
                articleId: true,
                departmentEventId: true,
              },
            },
          },
        })
        realEditorSession = Boolean(session)
        const metadata = asRecord(session?.metadata)
        sessionMemorySummary =
          typeof metadata.memorySummary === "string" ? metadata.memorySummary : ""
        pinnedContextSummary =
          session?.contextRefs
            .map((ref) =>
              `${ref.type}:${ref.label ?? ref.targetId}${
                ref.department ? ` dept=${ref.department}` : ""
              }${ref.jobId ? ` job=${ref.jobId}` : ""}${
                ref.articleId ? ` article=${ref.articleId}` : ""
              }${ref.departmentEventId ? ` event=${ref.departmentEventId}` : ""}`
            )
            .join(" | ") || "None"
      } catch (error) {
        if (!isMissingEditorSchema(error)) throw error
      }
    }

    if (latestUserMessage.trim() && realEditorSession) {
      await prisma.editorMessage.create({
        data: {
          sessionId,
          role: "user",
          content: latestUserMessage.trim().slice(0, 4000),
          metadata: { source: "editor_chat" } as Prisma.InputJsonObject,
        },
      }).catch((error) => {
        console.error("[manager] save editor user msg:", error)
      })
      await prisma.editorSession.update({
        where: { id: sessionId },
        data: {
          lastMessageAt: new Date(),
        },
      }).catch(() => {})
    } else if (latestUserMessage.trim()) {
      await prisma.managerChatMessage.create({
        data: {
          role: "user",
          content: latestUserMessage.trim().slice(0, 2000),
          metadata: { sessionId, source: "editor_chat" } as Prisma.InputJsonObject,
        },
      }).catch((error) => {
        console.error("[manager] save user msg:", error)
      })
    }

    if (realEditorSession && Object.keys(editorContext).length > 0) {
      const target = editorContextTarget(editorContext)
      await prisma.editorContextRef.create({
        data: {
          sessionId,
          type: target.type,
          targetId: target.targetId,
          label: target.label,
          department: target.department,
          jobId: target.jobId,
          articleId: target.articleId,
          departmentEventId: target.departmentEventId,
          metadata: editorContext as Prisma.InputJsonObject,
        },
      }).catch((error) => {
        console.error("[manager] save editor context ref:", error)
      })
    }

    const editorSessionRows = realEditorSession
      ? await prisma.editorMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
          take: 24,
          select: {
            role: true,
            content: true,
            metadata: true,
            jobId: true,
          },
        })
      : []

    const sessionRows = realEditorSession ? [] : await prisma.managerChatMessage.findMany({
      where: { jobId: null },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        role: true,
        content: true,
        metadata: true,
        jobId: true,
      },
    })
    const sessionHistorySource = realEditorSession ? editorSessionRows : sessionRows
    const sessionHistory = boundedHistory(
      sessionHistorySource
      .filter((message) => {
        if (message.jobId) return false
        if (isJobOrSystemMetadata(message.metadata)) return false
        if (realEditorSession) return true
        if (sessionId === LEGACY_SESSION_ID) return true
        return asRecord(message.metadata).sessionId === sessionId
      })
      .reverse()
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }))
    )

    const totalArticles = await prisma.newsArticle.count()

    const topicsRaw = await prisma.newsArticle.groupBy({
      by: ["topic"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })

    const newest = await prisma.newsArticle.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    })

    const [
      aiLogs,
      activeJobs,
      recentFailures,
      pendingDrafts,
      missingSummary,
      missingTags,
      missingSentiment,
      ragStatus,
      departmentSummaries,
      editorInbox,
      criticalDepartmentEvents,
    ] = await Promise.all([
      prisma.aiLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.adminAiJob.findMany({
        where: { status: { in: ["queued", "running", "failed"] } },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          retryCount: true,
          maxRetries: true,
          updatedAt: true,
        },
      }),
      prisma.adminAiJob.findMany({
        where: { status: { in: ["failed", "dead_letter"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { title: true, error: true, retryCount: true, maxRetries: true },
      }),
      prisma.newsArticle.count({
        where: { aiGenerated: true, published: false },
      }),
      prisma.newsArticle.count({ where: { summary: null } }),
      prisma.newsArticle.count({ where: { aiTags: null } }),
      prisma.newsArticle.count({ where: { sentiment: null } }),
      getRagStatus(),
      getDepartmentSummaries(),
      prisma.adminDepartmentEvent.findMany({
        where: {
          needsEditorReview: true,
          status: { notIn: ["resolved", "archived"] },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          department: true,
          title: true,
          severity: true,
          body: true,
        },
      }),
      prisma.adminDepartmentEvent.findMany({
        where: {
          severity: { in: ["warning", "error"] },
          status: { notIn: ["resolved", "archived"] },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          department: true,
          title: true,
          severity: true,
          body: true,
        },
      }),
    ])

    const context = {
      totalArticles,
      topics: topicsRaw.map((t) => `${t.topic}(${t._count.id})`),
      lastSync: newest?.fetchedAt
        ? new Date(newest.fetchedAt).toLocaleString()
        : "Never",
      recentAiActions: aiLogs.map((l) =>
        `${l.action} via ${l.model} - ${l.ms}ms`
      ),
      coverageGaps: {
        missingSummary,
        missingTags,
        missingSentiment,
        pendingDrafts,
      },
      activeJobs: activeJobs.map(
        (job) =>
          `${job.title} [${job.status}, ${job.retryCount}/${job.maxRetries}]`
      ),
      recentFailures: recentFailures.map(
        (job) =>
          `${job.title}: ${(job.error ?? "unknown").slice(0, 120)} (${job.retryCount}/${job.maxRetries})`
      ),
      ragStatus,
      departmentSummaries: departmentSummaries.map(
        (department) =>
          `${department.label}: ${department.unreadCount} unread, ${department.activeJobs} active, ${department.failedJobs} failed, ${department.needsEditorReviewCount} editor inbox`
      ),
      editorInbox: editorInbox.map(
        (event) =>
          `${event.department}: ${event.title} [${event.severity}] ${event.body.slice(0, 120)}`
      ),
      criticalDepartmentEvents: criticalDepartmentEvents.map(
        (event) =>
          `${event.department}: ${event.title} [${event.severity}] ${event.body.slice(0, 120)}`
      ),
    }

    const systemPrompt = `You are the LivePulse Manager AI.
Current System Context:
- Total Articles: ${context.totalArticles}
- Topics: ${context.topics.join(", ")}
- Last Sync: ${context.lastSync}
- Recent AI Actions: ${context.recentAiActions.join(", ")}
- Coverage Gaps: ${context.coverageGaps.missingSummary} missing summaries, ${context.coverageGaps.missingTags} missing tags, ${context.coverageGaps.missingSentiment} missing sentiment, ${context.coverageGaps.pendingDrafts} pending newsroom drafts
- Active Jobs: ${context.activeJobs.length > 0 ? context.activeJobs.join(", ") : "None"}
- Recent Failures: ${context.recentFailures.length > 0 ? context.recentFailures.join(", ") : "None"}
- RAG Status: ${context.ragStatus.embedded}/${context.ragStatus.totalPublished} published articles indexed (${context.ragStatus.coverage}%), model ${context.ragStatus.embeddingModel}, last error ${context.ragStatus.lastError ?? "none"}
- Department Pipelines: ${context.departmentSummaries.join(" | ")}
- Main Editor Inbox: ${context.editorInbox.length > 0 ? context.editorInbox.join(" | ") : "Empty"}
- Critical Department Events: ${context.criticalDepartmentEvents.length > 0 ? context.criticalDepartmentEvents.join(" | ") : "None"}
- Main Editor Session: ${realEditorSession ? sessionId : "Legacy filtered chat bridge"}
- Session Memory Summary: ${sessionMemorySummary || "No durable memory summary yet"}
- Pinned Context Refs: ${pinnedContextSummary}
- Selected Editor Context: ${Object.keys(editorContext).length > 0 ? JSON.stringify(editorContext).slice(0, 2000) : "None"}
- Ollama Status: inferred from recent AI actions and failures; if the admin reports ECONNREFUSED/model errors, ask them to start Ollama or install the configured model.

You help the administrator manage the newsroom, analyze performance, and orchestrate the agents. Answer professionally and with insight based on the provided context.

Important task policy:
- Do not claim you have started, queued, launched, or will notify the admin about a task unless a separate action card has actually been clicked.
- If the admin asks you to run work, explain what can be done and tell them to use the action buttons shown below your reply.
- Never say "I will notify you" from chat alone. Notifications are created only after an admin task is queued.

TASK EXECUTION RULES:
You can suggest executable tasks by including action cards in your response.

When to suggest action cards:
- User asks to "run", "start", "trigger", "generate", "process", "reindex", "scan", or "create" something
- User asks about something that requires fresh data

When NOT to suggest action cards:
- User is asking a question that you can answer from context
- User is asking for analysis or comparison

How to suggest action cards:
First answer the question in text.
Then, if relevant, end your response with:
[ACTION: <jobType> | <label> | <paramsJson>]

Valid action formats:
[ACTION: newsroom_cycle | Run AI Newsroom Scout | {}]
[ACTION: ai_batch | Batch Summarize Articles | {"task":"summarize","limit":20}]
[ACTION: rag_reindex | Reindex Missing Articles | {"mode":"missing","limit":50}]
[ACTION: digest_generate | Regenerate Today's Digest | {"regen":true}]

CRITICAL: Never say "I started", "I will run", or "I notified you" unless an action card was clicked and a job was actually created. You can only SUGGEST. The admin must click to confirm.`

    const chatMessages: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...(sessionHistory.length > 0
        ? sessionHistory
        : boundedHistory(
            safeMessages.filter(
              (message): message is { role: "user" | "assistant"; content: string } =>
                message.role === "user" || message.role === "assistant"
            ),
            20
          )
      ).map((message) => ({
        role: message.role,
        content: message.content.slice(0, 1000),
      })),
    ]
    const fallbackActionCards = buildAdminAiActionCards(latestUserMessage)

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        const start = Date.now()
        let fullReply = ""

        try {
          sendSse(controller, encoder, { type: "start", model: MODELS.MANAGER })

          const result = await ollamaChatStream(
            MODELS.MANAGER,
            chatMessages,
            (token: string) => {
              fullReply += token
              sendSse(controller, encoder, { type: "token", content: token })
            }
          )

          const parsedActionCards = parseActionCards(fullReply)
          const actionCards =
            parsedActionCards.length > 0 ? parsedActionCards : fallbackActionCards
          const cleanReply = fullReply.replace(actionPattern, "").trim()

          for (const card of actionCards) {
            sendSse(controller, encoder, {
              type: "action_card",
              ...card,
              card,
            })
          }

          sendSse(controller, encoder, {
            type: "done",
            content: cleanReply,
            model: MODELS.MANAGER,
            actionCards,
          })

          if (realEditorSession) {
            await prisma.editorMessage.create({
              data: {
                sessionId,
                role: "assistant",
                content: cleanReply || "No response",
                metadata:
                  actionCards.length > 0
                    ? ({ actionCards, model: MODELS.MANAGER, tokens: result.tokens, ms: result.ms, source: "editor_chat" } as Prisma.InputJsonObject)
                    : ({ model: MODELS.MANAGER, tokens: result.tokens, ms: result.ms, source: "editor_chat" } as Prisma.InputJsonObject),
              },
            }).catch((error) => {
              console.error("[manager] save editor assistant msg:", error)
            })

            await prisma.editorSession.update({
              where: { id: sessionId },
              data: {
                lastMessageAt: new Date(),
              },
            }).catch(() => {})

            const messageCount = await prisma.editorMessage.count({
              where: { sessionId, jobId: null },
            }).catch(() => 0)
            if (messageCount >= 8 && messageCount % 8 === 0) {
              const summaryRows = await prisma.editorMessage.findMany({
                where: { sessionId, jobId: null },
                orderBy: { createdAt: "desc" },
                take: 12,
                select: { role: true, content: true },
              }).catch(() => [])
              const memorySummary = buildMemorySummary(summaryRows.reverse())
              await prisma.editorSession.update({
                where: { id: sessionId },
                data: {
                  metadata: {
                    memorySummary,
                    memoryMessageCount: messageCount,
                    memoryUpdatedAt: new Date().toISOString(),
                  } as Prisma.InputJsonObject,
                },
              }).catch((error) => {
                console.error("[manager] update editor memory summary:", error)
              })
            }
          } else {
            await prisma.managerChatMessage.create({
              data: {
                role: "assistant",
                content: cleanReply || "No response",
                metadata:
                  actionCards.length > 0
                    ? ({ actionCards, model: MODELS.MANAGER, tokens: result.tokens, ms: result.ms, sessionId, source: "editor_chat" } as Prisma.InputJsonObject)
                    : ({ model: MODELS.MANAGER, tokens: result.tokens, ms: result.ms, sessionId, source: "editor_chat" } as Prisma.InputJsonObject),
              },
            }).catch((error) => {
              console.error("[manager] save assistant msg:", error)
            })
          }

          await logAiAction({
            action: "manager",
            model: MODELS.MANAGER,
            prompt: systemPrompt.slice(0, 200),
            tokens: result.tokens ?? null,
            ms: result.ms ?? Date.now() - start,
            success: true,
          }).catch(() => {})
        } catch (error) {
          console.error("[manager stream] error:", error)
          sendSse(controller, encoder, {
            type: "error",
            content: "AI service unavailable. Check that Ollama is running.",
          })
          await logAiAction({
            action: "manager",
            model: MODELS.MANAGER,
            prompt: systemPrompt.slice(0, 200),
            tokens: null,
            ms: Date.now() - start,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }).catch(() => {})
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    console.error("[ai manager] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

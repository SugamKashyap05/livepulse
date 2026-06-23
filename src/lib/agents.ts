import { prisma } from "@/lib/db"
import { aiClient, withRetry, MODELS, logAiAction, AI_PROVIDER } from "@/lib/ollama"

/**
 * AGENTIC NEWSROOM ENGINE
 * This library orchestrates specialized AI agents to process news.
 */

export const AGENTS = {
  SCOUT: {
    name: "Scout",
    role: "Impact Evaluator",
    systemPrompt: "You are the Scout Agent. Your job is to read news headlines and descriptions and determine their 'Viral Potential' and 'Global Impact'.",
  },
  CHECKER: {
    name: "Fact-Checker",
    role: "Truth Verifier",
    systemPrompt: "You are the Fact-Checker Agent. You analyze articles for logical consistency, source credibility (from name), and specific verifiable claims. You output a confidence score from 0-100.",
  },
  SPIN: {
    name: "Spin-Doctor",
    role: "Bias Analyst",
    systemPrompt: "You are the Spin-Doctor Agent. You detect political, emotional, and corporate bias in news reporting. You categorize the 'lean' and explain it briefly.",
  },
  WRITER: {
    name: "Editorial-AI",
    role: "Lead Writer",
    systemPrompt: "You are the Lead Writer. Your job is to take a set of news articles on a topic and synthesize a single, balanced, professional breaking report. Focus on clarity and neutrality.",
  }
}

function sanitizeForPrompt(text: string | null | undefined): string {
  if (!text) return ""
  return text
    .replace(/[<>]/g, "")
    .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions?/gi, "[redacted]")
    .replace(/system\s*prompt/gi, "[redacted]")
    .replace(/\[INST\]/gi, "")
    .replace(/<\|.*?\|>/g, "")
    .replace(/you\s+are\s+now/gi, "[redacted]")
    .trim()
    .slice(0, 500)
}

async function recordActivity(agent: string, action: string, status: string, targetId?: string, content?: string) {
  return await prisma.agentActivity.create({
    data: { agent, action, status, targetId, content }
  })
}

/**
 * Fact-Checker Agent Logic
 */
export async function runFactChecker(articleId: string) {
  const article = await prisma.newsArticle.findUnique({ where: { id: articleId } })
  if (!article) return

  const activity = await recordActivity("Fact-Checker", "Verifying claims", "thinking", articleId)

  try {
    const prompt = `Analyze this article for factuality:
Title: ${sanitizeForPrompt(article.title)}
Source: ${sanitizeForPrompt(article.source)}
Content: ${sanitizeForPrompt(article.description)}

Task:
1. Rate the factual consistency from 0 to 100.
2. Briefly explain why.

Format:
SCORE: [number]
REASON: [text]`

    const startMs = Date.now()
    const response = await withRetry(() => aiClient.chat.completions.create({
      model: MODELS.fast,
      messages: [
        { role: "system", content: AGENTS.CHECKER.systemPrompt },
        { role: "user", content: prompt }
      ]
    }))
    const ms = Date.now() - startMs
    const result = {
      content: response.choices[0]?.message?.content ?? "",
      tokens: response.usage?.total_tokens ?? 0,
      ms
    }

    const scoreMatch = result.content.match(/SCORE:\s*(\d+)/i)
    const reasonMatch = result.content.match(/REASON:\s*([\s\S]*)/i)

    const rawScore = scoreMatch ? parseInt(scoreMatch[1]) : 70
    const score = Number.isNaN(rawScore)
      ? 70
      : Math.min(100, Math.max(0, rawScore))
    const reason = reasonMatch ? reasonMatch[1].trim() : "Analysis complete."

    await prisma.newsArticle.update({
      where: { id: articleId },
      data: { factScore: score, agentNotes: reason }
    })

    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: { status: "completed", content: `Verified with score ${score}` }
    })

    await logAiAction({
      action: "fact-check",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      promptTokens: response.usage?.prompt_tokens ?? undefined,
      completionTokens: response.usage?.completion_tokens ?? undefined,
      durationMs: ms,
      success: true,
      articleId: articleId,
    })
    return score
  } catch (e) {
    await logAiAction({
      action: "fact-check",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      success: false,
      errorMessage: String(e),
      articleId: articleId,
    }).catch(() => {})
    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: { status: "error", content: String(e) }
    })
    throw e
  }
}

/**
 * Spin-Doctor Agent Logic
 */
export async function runSpinDoctor(articleId: string) {
  const article = await prisma.newsArticle.findUnique({ where: { id: articleId } })
  if (!article) return

  const activity = await recordActivity("Spin-Doctor", "Analyzing Bias", "thinking", articleId)

  try {
    const prompt = `Analyze the reporting bias of this piece:
Title: ${sanitizeForPrompt(article.title)}
Source: ${sanitizeForPrompt(article.source)}
Content: ${sanitizeForPrompt(article.description)}

Task: Summarize the emotional or political lean of this reporting in one sentence.`

    const startMs = Date.now()
    const response = await withRetry(() => aiClient.chat.completions.create({
      model: MODELS.fast,
      messages: [
        { role: "system", content: AGENTS.SPIN.systemPrompt },
        { role: "user", content: prompt }
      ]
    }))
    const ms = Date.now() - startMs
    const result = {
      content: response.choices[0]?.message?.content ?? "",
      tokens: response.usage?.total_tokens ?? 0,
      ms
    }

    const bias = result.content.trim()

    await prisma.newsArticle.update({
      where: { id: articleId },
      data: { biasAnalysis: bias }
    })

    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: { status: "completed", content: "Bias analysis finished" }
    })

    await logAiAction({
      action: "spin-doctor",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      promptTokens: response.usage?.prompt_tokens ?? undefined,
      completionTokens: response.usage?.completion_tokens ?? undefined,
      durationMs: ms,
      success: true,
      articleId: articleId,
    })
    return bias
  } catch (e) {
    await logAiAction({
      action: "spin-doctor",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      success: false,
      errorMessage: String(e),
      articleId: articleId,
    }).catch(() => {})
    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: { status: "error", content: String(e) }
    })
    throw e
  }
}


/**
 * SCOUT GENERATION: Create 5 autonomous articles from database context
 */
export async function runScoutGeneration() {
  const activity = await recordActivity("Scout", "Generating Autonomous Reports", "thinking")
  try {
    const topics = ["technology", "world", "business", "science", "sports", "india"]
    let generatedCount = 0

    for (const topicName of topics) {
      // 1. Get context articles
      const context = await prisma.newsArticle.findMany({
        where: { topic: topicName, image: { not: null } },
        take: 5,
        orderBy: { pubDate: "desc" },
        select: {
          title: true,
          description: true,
          source: true,
          image: true,
        },
      })

      if (context.length === 0) continue

      // 2. Extract an image from context
      const image = context[0].image

      // 3. Generate summary of news context
      const newsGist = context
        .map((c) =>
          `- ${sanitizeForPrompt(c.title)} (${sanitizeForPrompt(c.source)})${
            c.description
              ? `\n  ${sanitizeForPrompt(c.description).slice(0, 200)}`
              : ""
          }`
        )
        .join("\n")

      const prompt = `Based on these recent headlines in ${topicName}:\n${newsGist}\n\nTask:
Write a single, 3-paragraph breaking news report synthesis that connects these events.
Ensure the tone is professional, investigative, and engaging.

Format:
TITLE: [Headline]
CONTENT: [Body text]`

      const startMs = Date.now()
      const response = await withRetry(() => aiClient.chat.completions.create({
        model: MODELS.fast,
        messages: [
          { role: "system", content: AGENTS.WRITER.systemPrompt },
          { role: "user", content: prompt }
        ]
      }))
      const ms = Date.now() - startMs
      const result = {
        content: response.choices[0]?.message?.content ?? "",
        tokens: response.usage?.total_tokens ?? 0,
        ms
      }

      const titleMatch = result.content.match(/TITLE:\s*(.*)/i)
      const contentMatch = result.content.match(/CONTENT:\s*([\s\S]*)/i)

      const title = titleMatch ? titleMatch[1].trim() : `${topicName} Intelligence Report`
      const body = contentMatch ? contentMatch[1].trim() : result.content
      const id = `ai-${topicName.toLowerCase()}-${Date.now()}`

      await prisma.newsArticle.create({
        data: {
          id,
          title,
          description: body,
          link: `/ai-news/${id}`,
          pubDate: new Date(),
          source: "LivePulse AI",
          topic: topicName.toLowerCase(),
          slug: topicName.toLowerCase(),
          image: image,
          aiProcessed: false,
          aiGenerated: true,
          published: false, // Wait for admin approval
        }
      })
      await logAiAction({
        action: "scout",
        model: MODELS.fast,
        provider: AI_PROVIDER,
        promptTokens: response.usage?.prompt_tokens ?? undefined,
        completionTokens: response.usage?.completion_tokens ?? undefined,
        durationMs: ms,
        success: true,
        articleId: id,
      })
      generatedCount++
    }

    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: { status: "completed", content: `Successfully generated ${generatedCount} investigative reports for review.` }
    })

    return true
  } catch (e) {
    await logAiAction({
      action: "scout",
      model: MODELS.fast,
      provider: AI_PROVIDER,
      success: false,
      errorMessage: String(e),
    }).catch(() => {})
    await prisma.agentActivity.update({
      where: { id: activity.id },
      data: { status: "error", content: String(e) }
    })
    throw e
  }
}

/**
 * Full Agentic Cycle updated with Generation
 */
export async function runFullAgenticCycle() {
  // Phase 1: Generate new Scout drafts
  await runScoutGeneration()

  // Phase 2: Process all unprocessed articles, including fresh Scout drafts.
  const unprocessed = await prisma.newsArticle.findMany({
    where: { aiProcessed: false },
    take: 10,
    orderBy: { fetchedAt: "desc" },
  })

  for (const art of unprocessed) {
    await runFactChecker(art.id)
    await runSpinDoctor(art.id)
    await prisma.newsArticle.update({
      where: { id: art.id },
      data: { aiProcessed: true }
    })
  }
}

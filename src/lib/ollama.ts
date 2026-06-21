/* eslint-disable @typescript-eslint/no-unused-vars */
import { prisma } from "@/lib/db"
import crypto from "crypto"
import { sanitizeAiText } from "@/lib/textSafety"

/**
 * Ollama AI Client Utility
 * Handles all communication with the local Ollama instance (localhost:11434).
 */

class Semaphore {
  private max: number;
  private current: number;
  private queue: Array<() => void>;

  constructor(max: number) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.current--;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

const ollamaSemaphore = new Semaphore(1);

export function isAiOverloaded(): boolean {
  return ollamaSemaphore.getQueueLength() > 5;
}

export interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export type OllamaChatOptions = {
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  [key: string]: unknown
}

type ManagerContext = {
  totalArticles: number
  topics: string[]
  lastSync: string
  recentAiActions: string[]
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434"
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3"
export const EMBEDDING_MODEL =
  process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text:latest"
export const EMBEDDING_DIM = 768
const EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000
const EMBEDDING_CACHE_MAX = 100

type EmbeddingCacheEntry = {
  vector: number[]
  expiresAt: number
}

const embeddingCache = new Map<string, EmbeddingCacheEntry>()

// Specialized Models
export const MODELS = {
  SUMMARY: process.env.OLLAMA_SUMMARY_MODEL || "llama3:8b",
  DIGEST: process.env.OLLAMA_DIGEST_MODEL || "llama3",
  CHAT: process.env.OLLAMA_CHAT_MODEL || "llama3",
  MANAGER: process.env.OLLAMA_MANAGER_MODEL || "llama3",
  FAST: process.env.OLLAMA_FAST_MODEL || "phi3:3.8b",
}

function getEmbeddingCacheKey(text: string) {
  return crypto
    .createHash("sha256")
    .update(text.toLowerCase().trim())
    .digest("hex")
}

function setEmbeddingCache(key: string, vector: number[]) {
  if (embeddingCache.has(key)) embeddingCache.delete(key)
  embeddingCache.set(key, {
    vector,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  })

  while (embeddingCache.size > EMBEDDING_CACHE_MAX) {
    const oldestKey = embeddingCache.keys().next().value
    if (!oldestKey) break
    embeddingCache.delete(oldestKey)
  }
}

function getEmbeddingCache(key: string) {
  const cached = embeddingCache.get(key)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    embeddingCache.delete(key)
    return null
  }

  embeddingCache.delete(key)
  embeddingCache.set(key, cached)
  return cached.vector
}

type AiLogInput = {
  action: string
  model: string
  prompt?: string | null
  tokens?: number | null
  ms?: number | null
  success?: boolean
  error?: string | null
}

export async function logAiAction(input: AiLogInput): Promise<void>
export async function logAiAction(
  action: string,
  model: string,
  ms: number,
  tokens?: number,
  success?: boolean,
  error?: string
): Promise<void>
export async function logAiAction(
  inputOrAction: AiLogInput | string,
  model?: string,
  ms?: number,
  tokens?: number,
  success: boolean = true,
  error?: string
) {
  const input: AiLogInput = typeof inputOrAction === "string"
    ? {
        action: inputOrAction,
        model: model || DEFAULT_MODEL,
        ms: ms ?? null,
        tokens: tokens ?? null,
        success,
        error: error ?? null,
      }
    : inputOrAction

  try {
    await prisma.aiLog.create({
      data: {
        action: input.action,
        model: input.model,
        prompt: input.prompt ?? null,
        tokens: input.tokens ?? null,
        ms: input.ms ?? null,
        success: input.success ?? true,
        error: input.error ?? null,
      }
    })
  } catch (e) {
    console.error("[AI Log Error]:", e)
  }
}

async function getOllamaErrorMessage(response: Response) {
  const body = await response.text().catch(() => "")
  if (!body) {
    return `Ollama error ${response.status}: ${response.statusText}`
  }

  try {
    const data = JSON.parse(body) as { error?: string }
    return `Ollama error ${response.status}: ${data.error || body}`
  } catch {
    return `Ollama error ${response.status}: ${body}`
  }
}

export async function ollamaChat(
  model: string,
  messages: OllamaMessage[],
  options: OllamaChatOptions = {}
) {
  await ollamaSemaphore.acquire()
  const start = Date.now()
  const timeoutMs =
    typeof options.timeoutMs === "number" ? options.timeoutMs : 300000
  const { timeoutMs: _timeoutMs, ...ollamaOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: ollamaOptions,
      }),
    })

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`)
    const data = await response.json()
    const ms = Date.now() - start
    const tokens = (data.prompt_eval_count || 0) + (data.eval_count || 0)
    
    // We don't always want to log every single chat completion here to prevent noise,
    // call logAiAction externally if needed.
    
    return {
      content: data.message.content,
      tokens,
      ms
    }
  } catch (error) {
    console.error("[Ollama Chat Error]:", error)
    throw error
  } finally {
    clearTimeout(timeout)
    ollamaSemaphore.release()
  }
}

export async function ollamaChatStream(
  model: string,
  messages: OllamaMessage[],
  onChunk: (token: string) => void,
  options: Record<string, unknown> = {}
): Promise<{ content: string; tokens: number; ms: number }> {
  await ollamaSemaphore.acquire()
  try {
    const start = Date.now()
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options,
      }),
    })

    if (!response.ok) {
      throw new Error(await getOllamaErrorMessage(response))
    }

    if (!response.body) {
      throw new Error("No response body from Ollama")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ""
    let totalTokens = 0
    let buffer = ""

    const readLine = (line: string) => {
      if (!line.trim()) return false

      const parsed = JSON.parse(line)
      if (parsed.message?.content) {
        fullContent += parsed.message.content
        onChunk(parsed.message.content)
      }
      if (typeof parsed.eval_count === "number") {
        totalTokens = parsed.eval_count
      }
      if (typeof parsed.prompt_eval_count === "number") {
        totalTokens += parsed.prompt_eval_count
      }

      return Boolean(parsed.done)
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (readLine(line)) {
          return {
            content: fullContent,
            tokens: totalTokens,
            ms: Date.now() - start,
          }
        }
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) {
      readLine(buffer)
    }

    return {
      content: fullContent,
      tokens: totalTokens,
      ms: Date.now() - start,
    }
  } finally {
    ollamaSemaphore.release()
  }
}

export async function chat(prompt: string, model: string = DEFAULT_MODEL) {
  await ollamaSemaphore.acquire()
  const start = Date.now()
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(await getOllamaErrorMessage(response))
    }

    const data: OllamaResponse = await response.json()
    const ms = Date.now() - start
    const tokens = (data.prompt_eval_count || 0) + (data.eval_count || 0)
    
    return {
      text: data.response,
      ms,
      model: data.model,
      tokens
    }
  } catch (error) {
    console.error("[Ollama Chat Error]:", error)
    throw error
  } finally {
    ollamaSemaphore.release()
  }
}

export async function structuredChat<T>(
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<T> {
  await ollamaSemaphore.acquire()
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. Do not include any explanations or markdown formatting outside the JSON block.`,
        stream: false,
        format: "json",
      }),
    })

    if (!response.ok) {
      throw new Error(await getOllamaErrorMessage(response))
    }

    const data: OllamaResponse = await response.json()
    
    let rawText = data.response.trim()
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (match && match[1]) {
      rawText = match[1].trim()
    } else {
      // Clean up truncated markdown blocks
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      const firstBrace = Math.min(
        rawText.indexOf('{') !== -1 ? rawText.indexOf('{') : Infinity,
        rawText.indexOf('[') !== -1 ? rawText.indexOf('[') : Infinity
      )
      const lastBrace = Math.max(
        rawText.lastIndexOf('}'),
        rawText.lastIndexOf(']')
      )
      if (firstBrace !== Infinity && lastBrace !== -1 && lastBrace >= firstBrace) {
        rawText = rawText.substring(firstBrace, lastBrace + 1)
      }
    }

    return JSON.parse(rawText) as T
  } catch (error) {
    console.error("[Ollama Structured Error]:", error)
    throw error
  } finally {
    ollamaSemaphore.release()
  }
}

export async function embedText(text: string): Promise<number[]> {
  const sanitized = sanitizeAiText(text, 500)
  if (!sanitized) throw new Error("Embedding input is empty")

  const cacheKey = getEmbeddingCacheKey(sanitized)
  const cached = getEmbeddingCache(cacheKey)
  if (cached) return cached

  await ollamaSemaphore.acquire()
  const start = Date.now()
  try {
    let response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: sanitized,
      }),
    })

    if (response.status === 404) {
      response = await fetch(`${OLLAMA_HOST}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: sanitized,
        }),
      })
    }

    if (!response.ok) {
      throw new Error(await getOllamaErrorMessage(response))
    }

    const data = await response.json()
    const vector = Array.isArray(data.embedding)
      ? data.embedding
      : Array.isArray(data.embeddings?.[0])
        ? data.embeddings[0]
        : null

    if (!vector || vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${vector?.length ?? 0}`
      )
    }

    setEmbeddingCache(cacheKey, vector)
    return vector
  } catch (error) {
    await logAiAction({
      action: "embed",
      model: EMBEDDING_MODEL,
      prompt: sanitized.slice(0, 200),
      tokens: null,
      ms: Date.now() - start,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {})
    console.error("[Ollama Embedding Error]:", error)
    throw error
  } finally {
    ollamaSemaphore.release()
  }
}

export async function generateDigest(
  articles: {
    title: string
    source: string
    topic: string
    description?: string | null
    sentiment?: string | null
  }[]
) {
  const prompt = `Generate a concise, professional daily news digest:

${articles
  .map(
    (a) =>
      `[${a.topic.toUpperCase()}] ${a.title} (${a.source})${
        a.sentiment ? ` [${a.sentiment}]` : ""
      }${a.description ? `\n  ${a.description.slice(0, 100)}` : ""}`
  )
  .join("\n")}

Group by topic. Note overall sentiment trends per section.
Highlight the most important breaking stories.`
  
  const result = await ollamaChat(MODELS.DIGEST, [
    { role: "system", content: "You are a professional news editor creating a concise daily briefing." },
    { role: "user", content: prompt }
  ], {
    num_ctx: 8192
  })
  
  return result.content
}

export async function managerChat(
  messages: OllamaMessage[],
  context: ManagerContext
) {
  const systemPrompt = `You are the LivePulse Manager AI. 
Current System Context:
- Total Articles: ${context.totalArticles}
- Topics: ${context.topics.join(", ")}
- Last Sync: ${context.lastSync}
- Recent AI Actions: ${context.recentAiActions.join(", ")}

You help the administrator manage the newsroom, analyze performance, and orchestrate the agents. Answer professionally and with insight based on the provided context.`

  const result = await ollamaChat(MODELS.MANAGER, [
    { role: "system", content: systemPrompt },
    ...messages
  ])
  
  return result.content
}

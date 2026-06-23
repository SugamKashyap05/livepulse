// src/lib/ollama.ts
// Unified AI provider client — supports NVIDIA NIM (production) and Ollama (local dev)

import OpenAI from "openai";
import { sanitizeAiOutput } from "@/lib/security";

const provider = process.env.AI_PROVIDER ?? "ollama";

export const aiClient = new OpenAI(
  provider === "nvidia"
    ? {
        apiKey: process.env.NVIDIA_API_KEY!,
        baseURL: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
      }
    : {
        apiKey: "ollama",
        baseURL: `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/v1`,
      }
);

export const MODELS = {
  fast: provider === "nvidia"
    ? "meta/llama-3.1-8b-instruct"
    : "llama3.1:8b",

  smart: provider === "nvidia"
    ? "meta/llama-3.1-70b-instruct"
    : "llama3.1:70b",

  reasoning: provider === "nvidia"
    ? "deepseek-ai/deepseek-v4-flash"
    : "deepseek-r1:latest",

  mini: provider === "nvidia"
    ? "meta/llama-3.2-3b-instruct"
    : "llama3.2:3b",

  summarize: provider === "nvidia"
    ? "mistralai/mixtral-8x7b-instruct-v0.1"
    : "mistral:7b",

  embed: provider === "nvidia"
    ? "nvidia/nv-embedqa-e5-v5"
    : "nomic-embed-text",
} as const;

export const AI_PROVIDER = provider;

// Retry wrapper — handles both 429 rate-limits AND request aborts/timeouts
// Critical for NVIDIA NIM free tier (40 RPM) and Vercel edge network latency
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1500
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const errObj = err && typeof err === "object" ? err as Record<string, unknown> : null;
      const message = errObj && typeof errObj.message === "string" ? errObj.message : "";
      const status = errObj && typeof errObj.status === "number" ? errObj.status : 0;

      const isRateLimit = status === 429 || message.includes("429");
      const isAbort = message.includes("aborted") || message.includes("abort") || message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("ECONNRESET");
      const isServerError = status >= 500 && status < 600;
      const isRetryable = isRateLimit || isAbort || isServerError;

      if (isRetryable && attempt < maxRetries) {
        // Longer backoff for rate limits, shorter for transient failures
        const multiplier = isRateLimit ? 2 : 1.5;
        const delay = baseDelayMs * Math.pow(multiplier, attempt);
        const reason = isRateLimit ? "Rate limited" : isAbort ? "Request aborted/timeout" : `Server error (${status})`;
        console.warn(`[AI] ${reason}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("[AI] Max retries exceeded");
}

// ─────────────────────────────────────────────
// EMBEDDINGS
// ─────────────────────────────────────────────

/**
 * Provider-aware text embedding.
 *
 * inputType is REQUIRED by nvidia/nv-embedqa-e5-v5 (asymmetric model):
 *   "passage" → for documents being indexed into the vector DB (indexArticle)
 *   "query"   → for user search queries being vectorized (searchRagContext)
 *
 * Using the wrong type degrades retrieval quality silently — the model
 * returns valid vectors but from the wrong embedding space.
 *
 * On Ollama (nomic-embed-text), inputType is accepted but ignored — safe.
 */
export async function embedText(
  text: string,
  inputType: "query" | "passage" = "passage"
): Promise<number[]> {
  const res = await withRetry(() =>
    aiClient.embeddings.create({
      model: MODELS.embed,
      input: text,
      encoding_format: "float",
      // NIM asymmetric models require input_type.
      // The OpenAI SDK passes unknown fields through to the JSON body.
      // @ts-expect-error — NIM-specific extension not in OpenAI types
      input_type: AI_PROVIDER === "nvidia" ? inputType : undefined,
    }, { signal: AbortSignal.timeout(20000) })
  );
  return res.data[0].embedding;
}

// Preserve the constant so rag.ts imports keep compiling
export const EMBEDDING_MODEL = MODELS.embed;
export const EMBEDDING_DIM = provider === "nvidia" ? 1024 : 768;

// ─────────────────────────────────────────────
// STRUCTURED CHAT (JSON output)
// ─────────────────────────────────────────────

/**
 * Calls the AI model and parses a typed JSON response.
 * Uses prompt-level instruction for JSON — NIM models don't all support
 * response_format: json_object, so we enforce via prompt + safe parse.
 */
export async function structuredChat<T>(
  systemPrompt: string,
  userMessage: string,
  model: string = MODELS.smart
): Promise<T> {
  const jsonSystemPrompt = `${systemPrompt}

IMPORTANT: You must respond with valid JSON only. No markdown, no code fences, no explanation. Raw JSON object only.`;

  const res = await withRetry(() =>
    aiClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: jsonSystemPrompt },
        { role: "user", content: userMessage },
      ],
      // Use json_object format for models that support it — NIM ignores
      // this param gracefully if unsupported, so safe to include
      response_format: { type: "json_object" },
      temperature: 0.1, // low temp for deterministic structured output
    }, { signal: AbortSignal.timeout(60000) })
  );

  const raw = sanitizeAiOutput(res.choices[0]?.message?.content ?? "");

  try {
    // Strip any accidental markdown fences if model ignored our instruction
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `[AI] structuredChat: Failed to parse model response as JSON.\nRaw output: ${raw.slice(0, 300)}`
    );
  }
}

/**
 * Basic provider-aware chat wrapper
 */
export async function chat(prompt: string, model: string = MODELS.smart): Promise<{ text: string }> {
  const res = await withRetry(() =>
    aiClient.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    }, { signal: AbortSignal.timeout(60000) })
  );
  const raw = res.choices[0]?.message?.content ?? "";
  return { text: sanitizeAiOutput(raw) };
}

/**
 * Generates a news digest from a list of articles.
 */
export async function generateDigest(articles: Array<{title: string, source: string, topic: string, description?: string | null, sentiment?: string | null}>): Promise<string> {
  const context = articles.map(a => `- [${a.topic}] ${a.title} (${a.source})${a.sentiment ? ` [Sentiment: ${a.sentiment}]` : ''}${a.description ? `\n  ${a.description.slice(0, 200)}` : ''}`).join('\n\n');
  const prompt = `You are the LivePulse executive editor. Below are the top news articles of the day. Write a brief, engaging daily news digest. Keep it under 4 paragraphs. Focus on the most important trends.\n\n${context}`;
  
  const res = await chat(prompt, MODELS.smart);
  return res.text;
}

// ─────────────────────────────────────────────
// STREAMING
// ─────────────────────────────────────────────

/**
 * Provider-aware streaming chat.
 * Name kept as ollamaChatStream for backward-compatible imports.
 * Returns an OpenAI stream — pipe chunks to SSE/ReadableStream as before.
 */
export async function ollamaChatStream(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model: string = MODELS.fast
) {
  // withRetry wraps the stream creation, not consumption.
  // If 429 fires here the stream hasn't started yet — safe to retry.
  return withRetry(() =>
    aiClient.chat.completions.create({
      model,
      messages,
      stream: true,
    }, { signal: AbortSignal.timeout(55000) }) // stream can take longer
  );
}

// ─────────────────────────────────────────────
// RATE LIMIT GUARD  (replaces isAiOverloaded)
// ─────────────────────────────────────────────

/**
 * Tracks requests in a 60-second sliding window.
 * Returns true when approaching the 40 RPM NIM free-tier ceiling.
 * On Ollama (local), always returns false — no rate limit applies.
 *
 * Call this before firing batch/autoSync jobs to pre-empt 429s.
 */
const _requestTimestamps: number[] = [];
const RPM_CEILING = 38; // stay 2 below the 40 RPM hard limit

export function isAiOverloaded(): boolean {
  if (AI_PROVIDER !== "nvidia") return false; // Ollama has no limit

  const now = Date.now();
  const windowStart = now - 60_000;

  // Evict timestamps older than 60 seconds
  while (_requestTimestamps.length > 0 && _requestTimestamps[0] < windowStart) {
    _requestTimestamps.shift();
  }

  // Record this check as an intent to fire a request
  _requestTimestamps.push(now);

  return _requestTimestamps.length >= RPM_CEILING;
}

// ─────────────────────────────────────────────
// AUDIT LOGGING  (preserves logAiAction)
// ─────────────────────────────────────────────

/**
 * Logs every AI call to the database for forensics, cost tracking,
 * and fine-tuning corpus. NEVER remove — this is your audit trail.
 *
 * If the DB write fails, we log to console but do NOT throw —
 * a logging failure must never crash an inference call.
 */
export async function logAiAction(params: {
  action: string;       // e.g. "summarize", "fact-check", "embed"
  model: string;        // exact model string used
  provider?: string;    // "nvidia" | "ollama"
  promptTokens?: number | null;
  completionTokens?: number | null;
  durationMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
  articleId?: string | null;
  // Legacy aliases
  prompt?: string | null;
  tokens?: number | null;
  ms?: number | null;
  error?: string | null;
}): Promise<void> {
  try {
    // Dynamic import keeps Prisma out of edge runtime if any routes use it
    const { prisma } = await import("@/lib/db"); // Using @/lib/db as it was used in other places
    await prisma.aiLog.create({
      data: {
        action: params.action,
        model: params.model,
        provider: params.provider ?? AI_PROVIDER,
        promptTokens: params.promptTokens ?? null,
        completionTokens: params.completionTokens ?? params.tokens ?? null,
        tokens: params.tokens ?? null,
        prompt: params.prompt ?? null,
        ms: params.durationMs ?? params.ms ?? null,
        success: params.success,
        error: params.errorMessage ?? params.error ?? null,
        articleId: params.articleId ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  } catch (err) {
    // Logging must never crash inference — degrade gracefully
    console.error("[AI] logAiAction failed to write to DB:", err);
  }
}

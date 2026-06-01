import { prisma } from "@/lib/db"

/**
 * Ollama AI Client Utility
 * Handles all communication with the local Ollama instance (localhost:11434).
 */

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

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434"
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3"

// Specialized Models
export const MODELS = {
  SUMMARY: process.env.OLLAMA_SUMMARY_MODEL || "llama3:8b",
  DIGEST: process.env.OLLAMA_DIGEST_MODEL || "llama3",
  CHAT: process.env.OLLAMA_CHAT_MODEL || "llama3",
  MANAGER: process.env.OLLAMA_MANAGER_MODEL || "llama3",
  FAST: process.env.OLLAMA_FAST_MODEL || "phi3:3.8b",
}

export async function logAiAction(action: string, model: string, ms: number, tokens?: number, success: boolean = true, error?: string) {
  try {
    await prisma.aiLog.create({
      data: { action, model, ms, tokens, success, error }
    })
  } catch (e) {
    console.error("[AI Log Error]:", e)
  }
}

export async function ollamaChat(model: string, messages: OllamaMessage[], options: any = {}) {
  const start = Date.now()
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options,
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
  }
}

export async function chat(prompt: string, model: string = DEFAULT_MODEL) {
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
      throw new Error(`Ollama error: ${response.statusText}`)
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
  }
}

export async function structuredChat<T>(
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<T> {
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
      throw new Error(`Ollama error: ${response.statusText}`)
    }

    const data: OllamaResponse = await response.json()
    return JSON.parse(data.response) as T
  } catch (error) {
    console.error("[Ollama Structured Error]:", error)
    throw error
  }
}

export async function generateDigest(articles: { title: string; source: string; topic: string }[]) {
  const prompt = `Generate a concise, professional daily news digest from these articles:\n${articles.map(a => `- [${a.topic}] ${a.title} (${a.source})`).join("\n")}\n\nGroup by topic and highlight the most important breaking news.`
  
  const result = await ollamaChat(MODELS.DIGEST, [
    { role: "system", content: "You are a professional news editor creating a concise daily briefing." },
    { role: "user", content: prompt }
  ])
  
  return result.content
}

export async function managerChat(messages: OllamaMessage[], context: any) {
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

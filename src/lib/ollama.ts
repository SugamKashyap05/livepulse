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

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434"
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3"

// Specialized Models
export const MODELS = {
  SUMMARY: process.env.OLLAMA_SUMMARY_MODEL || "llama3:8b",
  DIGEST: process.env.OLLAMA_DIGEST_MODEL || "gemma4:e4b",
  CHAT: process.env.OLLAMA_CHAT_MODEL || "llama3:8b",
  FAST: process.env.OLLAMA_FAST_MODEL || "phi3:3.8b",
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
    return {
      text: data.response,
      ms: Date.now() - start,
      model: data.model,
      tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
    }
  } catch (error) {
    console.error("[Ollama Chat Error]:", error)
    throw error
  }
}

/**
 * Handles streaming responses for a more "premium" live-typing feel
 */
export async function streamChat(
  prompt: string,
  onToken: (token: string) => void,
  model: string = DEFAULT_MODEL
) {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("Body reader not available")

    let done = false
    while (!done) {
      const { value, done: doneReading } = await reader.read()
      done = doneReading
      if (value) {
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split("\n")
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json: OllamaResponse = JSON.parse(line)
            if (json.response) onToken(json.response)
          } catch (e) {
            // Fragmented JSON, ignore
          }
        }
      }
    }
  } catch (error) {
    console.error("[Ollama Stream Error]:", error)
    throw error
  }
}

/**
 * Specifically for tasks requiring structured JSON output (tagging, sentiment)
 */
export async function structuredChat<T>(
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<T> {
  const start = Date.now()
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

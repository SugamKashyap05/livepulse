import { MODELS } from "@/lib/ollama"

export const dynamic = "force-dynamic"
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434"

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid request", { status: 400 })
    }

    // 1. Fetch Latest News Context (RAG)
    const recentArticles = await prisma.newsArticle.findMany({
      orderBy: { pubDate: "desc" },
      take: 20,
      select: { title: true, source: true, description: true, topic: true }
    })

    const context = recentArticles.map(a => `[${a.source}] (${a.topic}) ${a.title}: ${a.description}`).join("\n\n")

    const systemPrompt = `You are the LivePulse News Assistant. You help users navigate current events.
    Use the following news articles from our database to answer the user's questions. 
    If the information is not in the context, say you don't have that specific data yet.
    ALWAYS cite the source in square brackets like [BBC] or [Reuters].
    Be concise, helpful, and objective.

    Current News Context:
    ${context}`

    // 2. Prepare request for Ollama
    const ollamaMessages = [
        { role: "system", content: systemPrompt },
        ...messages
    ]

    const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        model: MODELS.CHAT, 
        messages: ollamaMessages,
        stream: true 
      }),
    })

    if (!ollamaResponse.ok) {
        throw new Error("Ollama chat failed")
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split("\n")
            
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const json = JSON.parse(line)
                if (json.message?.content) {
                  controller.enqueue(encoder.encode(json.message.content))
                }
                if (json.done) {
                    // Log the chat action occasionally or for tokens
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        } catch (err) {
          console.error("Chat Stream reading error:", err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })

  } catch (error) {
    console.error("[Chat API Error]:", error)
    return new Response(JSON.stringify({ error: "Chat failed" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}

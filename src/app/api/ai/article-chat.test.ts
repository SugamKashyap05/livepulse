import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./article-chat/route"
import { prisma } from "@/lib/db"
import { cachedHybridSearch } from "@/lib/ragCache"
import { ollamaChatStream } from "@/lib/ollama"
import { runGeneralChat } from "@/lib/ai/run-general-chat"

vi.mock("@/lib/ai/run-general-chat", () => ({
  runGeneralChat: vi.fn().mockResolvedValue(new Response("delegated stream"))
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    newsArticle: { findFirst: vi.fn(), findMany: vi.fn() },
    aiLog: { create: vi.fn().mockResolvedValue({}) },
    userTopicFollow: { findMany: vi.fn().mockResolvedValue([]) },
  }
}))

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("test-user-id")
}))

vi.mock("@/lib/rateLimit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfter: 0 })
}))

vi.mock("@/lib/ragScoring", () => ({
  getCachedConfidenceThreshold: vi.fn().mockResolvedValue(0.7)
}))

vi.mock("@/lib/ragCache", () => ({
  cachedHybridSearch: vi.fn()
}))

vi.mock("@/lib/ollama", () => ({
  MODELS: { smart: "test-model" },
  AI_PROVIDER: "test-provider",
  logAiAction: vi.fn().mockResolvedValue({}),
  ollamaChatStream: vi.fn().mockImplementation(async function* (messages: any) {
    yield { choices: [{ delta: { content: "Test response" } }] }
  })
}))

// Helper to create Request object
function createRequest(body: any) {
  return new Request("http://localhost/api/ai/article-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
}

// Helper to consume Server-Sent Events stream and return the chunks
async function consumeSseStream(response: Response) {
  if (!response.body) return []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const str = decoder.decode(value)
    chunks.push(str)
  }
  return chunks
}

// Extract system prompt from ollamaChatStream mock calls
function getSystemPrompt() {
  const calls = vi.mocked(ollamaChatStream).mock.calls
  if (calls.length === 0) return null
  const messages = calls[calls.length - 1][0]
  const systemMsg = messages.find((m: any) => m.role === "system")
  return systemMsg ? systemMsg.content : null
}

describe("POST /api/ai/article-chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.newsArticle.findMany).mockResolvedValue([])
  })

  it("scenario 1: returns real response for meta-question despite low RAG confidence", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue({
      id: "123", title: "Test Article", summary: "Test summary", topic: "test"
    } as any)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0, cached: false
    })

    const req = createRequest({ articleId: "123", messages: [{ role: "user", content: "what am i reading" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).not.toContain("I cannot answer this based on the provided context.")
    
    const systemPrompt = getSystemPrompt()
    expect(systemPrompt).toContain("Title: Test Article")
    expect(systemPrompt).not.toContain("CAVEAT:") 
  })

  it("scenario 2: appends caveat for factual question with low RAG confidence", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue({
      id: "123", title: "Test Article", summary: "Test summary", topic: "test"
    } as any)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0.1, cached: false
    })

    const req = createRequest({ articleId: "123", messages: [{ role: "user", content: "why did this happen?" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).not.toContain("I cannot answer this based on the provided context.")
    
    const systemPrompt = getSystemPrompt()
    expect(systemPrompt).toContain("CAVEAT: You only have access to the article metadata")
  })

  it("scenario 3: standard response for factual question with high RAG confidence", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue({
      id: "123", title: "Test Article", summary: "Test summary", topic: "test"
    } as any)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [{ id: "chunk1", title: "Chunk 1", content: "details", confidence: { sourceQualityScore: 0.9 } }],
      avgConf: 0.9,
      cached: false
    })

    const req = createRequest({ articleId: "123", messages: [{ role: "user", content: "why did this happen?" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).not.toContain("I cannot answer this based on the provided context.")
    
    const systemPrompt = getSystemPrompt()
    expect(systemPrompt).not.toContain("CAVEAT:")
    expect(systemPrompt).toContain("RETRIEVED CONTEXT")
  })

  it("scenario 4: hard refusal for factual question when metadata is missing and RAG is low", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue(null)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0.1, cached: false
    })

    const req = createRequest({ messages: [{ role: "user", content: "why did this happen?" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).toContain("I cannot answer this based on the provided context.")
    
    expect(vi.mocked(ollamaChatStream)).not.toHaveBeenCalled()
  })

  it("scenario 5: hard refusal for ambiguous question when metadata is missing and RAG is low", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue(null)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0.1, cached: false
    })

    const req = createRequest({ messages: [{ role: "user", content: "what do you mean" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).toContain("I cannot answer this based on the provided context.")
    
    expect(vi.mocked(ollamaChatStream)).not.toHaveBeenCalled()
  })

  it("scenario 6: meta-intent summarize request, summary=NULL, description present -> expects description used", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue({
      id: "123", title: "Test Article", summary: null, description: "Test description", topic: "test"
    } as any)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0.1, cached: false
    })

    const req = createRequest({ articleId: "123", messages: [{ role: "user", content: "summarize this article" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).not.toContain("I cannot answer this based on the provided context.")
    
    const systemPrompt = getSystemPrompt()
    expect(systemPrompt).toContain("Article Description (brief, from source feed — use only if no summary is available): Test description")
    expect(systemPrompt).toContain("INSTRUCTION: When the user asks to summarize, use the Article Summary or Article Description field above directly.")
    expect(systemPrompt).not.toContain("CAVEAT:")
  })

  it("scenario 7: meta-intent summarize request, summary=NULL, description=NULL -> expects soft refusal from LLM", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue({
      id: "123", title: "Test Article", summary: null, description: null, topic: "test"
    } as any)
    
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0.1, cached: false
    })

    // To simulate the LLM soft refusing because it lacks description/summary, we mock ollamaChatStream to return the refusal
    vi.mocked(ollamaChatStream).mockImplementation(async function* () {
      yield { choices: [{ delta: { content: "I cannot answer this based on the provided context." } }] }
    })

    const req = createRequest({ articleId: "123", messages: [{ role: "user", content: "summarize this article" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).toContain("I cannot answer this based on the provided context.")
    
    // It should have called the LLM because it didn't hit the hard refusal (since topic exists and intent is meta)
    expect(vi.mocked(ollamaChatStream)).toHaveBeenCalled()
    
    const systemPrompt = getSystemPrompt()
    expect(systemPrompt).not.toContain("Article Summary:")
    expect(systemPrompt).not.toContain("Article Description (brief")
  })

  it("scenario 8: delegates to runGeneralChat for cross-article intent", async () => {
    vi.mocked(prisma.newsArticle.findFirst).mockResolvedValue({
      id: "123", title: "Test Article", summary: "Test summary", topic: "test"
    } as any)
    vi.mocked(cachedHybridSearch).mockResolvedValue({
      trusted: [], avgConf: 0, cached: false
    })

    const req = createRequest({ articleId: "123", messages: [{ role: "user", content: "any other news on f1" }] })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const chunks = await consumeSseStream(res)
    expect(chunks.join("")).toBe("delegated stream")
    
    expect(vi.mocked(runGeneralChat)).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "any other news on f1" }],
      topicBias: "test",
      userId: "test-user-id",
      followedTopics: []
    })
    
    expect(vi.mocked(ollamaChatStream)).not.toHaveBeenCalled()
  })
})

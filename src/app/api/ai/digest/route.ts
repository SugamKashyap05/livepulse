import { chat, MODELS } from "@/lib/ollama"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const today = new Date().toISOString().split("T")[0]

    // 1. Check if cache exists
    const existing = await prisma.dailyDigest.findUnique({
      where: { date: today }
    })

    if (existing) {
      return new Response(JSON.stringify(existing), {
        headers: { "Content-Type": "application/json" }
      })
    }

    // 2. Fetch today's top articles
    const articles = await prisma.newsArticle.findMany({
      orderBy: { pubDate: "desc" },
      take: 25,
      select: { title: true, source: true, description: true }
    })

    if (articles.length === 0) {
      return new Response(JSON.stringify({ content: "Not enough news yet to generate a digest. Check back later!" }), {
        headers: { "Content-Type": "application/json" }
      })
    }

    // 3. Generate Digest
    const context = articles.map(a => `[${a.source}] ${a.title}: ${a.description}`).join("\n---\n")
    
    const prompt = `You are a professional news editor. Based on the following articles from today, write a "Daily Briefing" for our readers.
    The briefing should be around 5 paragraphs long and cover the most significant trends and stories.
    Be engaging, insightful, and concise. Use clear headings.

    Articles Context:
    ${context}

    Morning Briefing:`

    const aiResponse = await chat(prompt, MODELS.DIGEST)

    // 4. Save to DB
    const digest = await prisma.dailyDigest.create({
      data: {
        date: today,
        content: aiResponse.text
      }
    })

    // Log action
    await prisma.aiLog.create({
        data: {
            action: "digest",
            model: MODELS.DIGEST,
            ms: aiResponse.ms
        }
    })

    return new Response(JSON.stringify(digest), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("[Digest API Error]:", error)
    return new Response(JSON.stringify({ error: "Failed to generate digest" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
}

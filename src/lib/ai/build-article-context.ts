// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildArticleSystemContext(focusArticle: any): string {
  if (!focusArticle) {
    return ""
  }

  const parts: string[] = []
  parts.push("You are an AI assistant answering questions about the following article. Only state facts that are present in the provided metadata or context.")
  parts.push("--- ARTICLE METADATA ---")

  if (focusArticle.title) parts.push(`Title: ${focusArticle.title}`)
  if (focusArticle.topic) parts.push(`Topic: ${focusArticle.topic}`)
  if (focusArticle.source) parts.push(`Source: ${focusArticle.source}`)
  
  if (focusArticle.summary) {
    parts.push(`Article Summary: ${focusArticle.summary}`)
  } else if (focusArticle.description) {
    parts.push(`Article Description (brief, from source feed — use only if no summary is available): ${focusArticle.description}`)
  }
  
  if (focusArticle.sentiment) parts.push(`Sentiment: ${focusArticle.sentiment}`)
  if (focusArticle.bias) parts.push(`Bias: ${focusArticle.bias}`)
  if (focusArticle.publishedAt) {
    const pubDate = new Date(focusArticle.publishedAt).toISOString()
    parts.push(`Published At: ${pubDate}`)
  } else if (focusArticle.pubDate) {
    const pubDate = new Date(focusArticle.pubDate).toISOString()
    parts.push(`Published Date: ${pubDate}`)
  }

  if (parts.length === 2) {
    return "" // No actual metadata fields were appended
  }

  parts.push("------------------------")
  parts.push("INSTRUCTION: When the user asks to summarize, use the Article Summary or Article Description field above directly.")
  return parts.join("\n")
}

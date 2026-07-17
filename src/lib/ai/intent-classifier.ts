export type ChatIntent = "meta" | "cross-article" | "factual" | "ambiguous"

const CROSS_ARTICLE_PATTERNS = [
  /any\s+(other|more)\s+news/i,
  /what\s+else\s+is\s+happening/i,
  /any\s+(updates|news)\s+on/i,
  /what's\s+the\s+latest\s+on/i,
  /more\s+(news|articles)\s+(on|about)/i,
]

const META_PATTERNS = [
  /what\s+(am\s+i|news\s+am\s+i|are\s+we)\s+reading/i,
  /what\s+(is|does)\s+this\s+(article|aritcel|artical|news|page|post|story)\s+(about|on|tell|say)/i,
  /what\s+page\s+am\s+i\s+on/i,
  /(summarize|summerize|summarise)\s+(this|the|an|it|article|aritcel|artical|news|story)/i,
  /give\s+me\s+a\s+summary/i,
  /who\s+wrote\s+this/i,
  /when\s+was\s+this\s+(written|published)/i,
  /what\s+(is\s+the\s+)?topic/i,
  /tell\s+me\s+about\s+this\s+(article|aritcel|artical|news|story)/i,
  /what's\s+this\s+(article|aritcel|artical|news|story)/i,
  /is\s+this\s+(article|aritcel|artical|news|story)/i,
  /how\s+long\s+is\s+this/i,
  /what\s+(does|do)\s+this\s+(article|aritcel|artical|news|story)\s+(say|tell|mean)/i,
  /what\s+this\s+(article|aritcel|artical|news|story)\s+(tell|say|mean)/i,
  /give\s+me\s+the\s+gist/i,
  /complete\s+story/i,
  /whole\s+story/i
]

const FACTUAL_PATTERNS = [
  /^why\s+(did|is|are|do|does)/i,
  /^how\s+(did|is|are|do|does|many|much)/i,
  /^who\s+(is|are|did|was|were)/i,
  /^where\s+(is|are|did|was|were)/i,
  /^when\s+(did|is|was|will)/i,
  /^what\s+happened/i,
  /^explain\s+the/i,
  /^what\s+(are|is|did|were|was)\s+the/i,
  /^can\s+you\s+explain/i,
  /^tell\s+me\s+(why|how|who|where|what)/i
]

export function classifyChatIntent(message: string): ChatIntent {
  const lowerMsg = message.trim()

  // Precedence 1: cross-article questions
  // Checked before meta because "is there any more news" could collide with "news" matching meta if we're not careful.
  for (const pattern of CROSS_ARTICLE_PATTERNS) {
    if (pattern.test(lowerMsg)) {
      return "cross-article"
    }
  }

  // Precedence 2: meta questions about the current article
  for (const pattern of META_PATTERNS) {
    if (pattern.test(lowerMsg)) {
      return "meta"
    }
  }

  for (const pattern of FACTUAL_PATTERNS) {
    if (pattern.test(lowerMsg)) {
      return "factual"
    }
  }

  return "ambiguous"
}

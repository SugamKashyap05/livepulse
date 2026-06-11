const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/gi,
  /system\s*prompt/gi,
  /\[INST\]/gi,
  /<\|.*?\|>/g,
  /you\s+are\s+now/gi,
  /disregard\s+(all\s+)?previous/gi,
  /new\s+instructions?:/gi,
  /override\s+(the\s+)?system/gi,
]

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

export function stripInjectionPatterns(text: string): string {
  let clean = text
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, "[redacted]")
  }
  return clean
}

export function sanitizeAiText(raw: string | null | undefined, limit = 500): string {
  if (!raw) return ""

  let text = decodeHtmlEntities(raw)
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/[<>]/g, "")
  text = stripInjectionPatterns(text)

  return text.replace(/\s+/g, " ").trim().slice(0, limit)
}

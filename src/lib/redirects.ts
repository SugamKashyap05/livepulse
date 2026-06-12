export function safeLocalRedirect(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback

  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback
  if (trimmed.includes("\\") || trimmed.includes("\n") || trimmed.includes("\r")) {
    return fallback
  }

  return trimmed
}

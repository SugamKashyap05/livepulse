export function triggerRagReindex(origin?: string) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return

  const baseUrl = origin || getServerBaseUrl()

  const url = new URL("/api/admin/rag/reindex", baseUrl)
  const body = JSON.stringify({ mode: "missing", limit: 20 })

  postReindex(url, adminSecret, body, 0)
}

function getServerBaseUrl() {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000"
  }

  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

function postReindex(
  url: URL,
  adminSecret: string,
  body: string,
  attempt: number
) {
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminSecret}`,
    },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch((error) => {
    if (attempt === 0) {
      setTimeout(() => postReindex(url, adminSecret, body, 1), 5000)
      return
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error(`[LivePulse RAG] Background reindex failed: ${message}`)
  })
}

type RateLimitRecord = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitRecord>()

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now()
  const record = buckets.get(key)

  if (!record || record.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return { allowed: true, retryAfter: 0 }
  }

  if (record.count >= options.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    }
  }

  record.count++
  return { allowed: true, retryAfter: 0 }
}

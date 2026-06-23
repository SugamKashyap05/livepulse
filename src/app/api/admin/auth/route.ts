import { NextResponse } from "next/server"
import { createAdminSession } from "@/lib/adminSessions"

const AUTH_RESPONSE_DELAY_MS = 100
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000
const LOCKOUT_MS = 60 * 1000

const loginAttempts = new Map<string, {
  count: number
  firstAttempt: number
  lockedUntil?: number
}>()

function delayAuthResponse() {
  return new Promise((resolve) => {
    setTimeout(resolve, AUTH_RESPONSE_DELAY_MS)
  })
}

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    await delayAuthResponse()
    return NextResponse.json(
      { error: "Admin auth is not configured" },
      { status: 500 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).password !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }

  const { password } = body as { password: string }

  if (password.length > 200) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"

  const now = Date.now()
  const record = loginAttempts.get(ip) || {
    count: 0,
    firstAttempt: now,
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    const remaining = Math.ceil((record.lockedUntil - now) / 1000)
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${remaining}s.` },
      { status: 429 }
    )
  }

  if (now - record.firstAttempt > WINDOW_MS) {
    record.count = 0
    record.firstAttempt = now
    delete record.lockedUntil
  }

  await delayAuthResponse()

  if (password !== adminSecret) {
    record.count++
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS
    }
    loginAttempts.set(ip, record)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  loginAttempts.delete(ip)

  const response = NextResponse.json({ success: true })
  const sessionToken = createAdminSession()
  response.cookies.set("admin_token", sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  })

  return response
}

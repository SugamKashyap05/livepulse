import { createNeonAuth } from "@neondatabase/auth/next/server"
import { jwtVerify } from "jose"
import { cookies } from "next/headers"

const baseUrl = process.env.NEON_AUTH_BASE_URL
const rawCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
const isValidSecret = rawCookieSecret && rawCookieSecret.length >= 32
const cookieSecret = isValidSecret ? rawCookieSecret : "development-neon-auth-cookie-secret-32"
const sessionDataCookieName = "__Secure-neon-auth.local.session_data"

type CachedNeonUser = {
  id?: string
  name?: string | null
  email?: string | null
}

export function isNeonAuthConfigured() {
  return Boolean(baseUrl && isValidSecret)
}

export const auth = createNeonAuth({
  baseUrl: baseUrl || "http://localhost:0",
  cookies: {
    secret: cookieSecret || "development-neon-auth-cookie-secret-32",
    sessionDataTtl: 300,
    sameSite: "strict",
  },
  logLevel: "warn",
})

export async function getCurrentUserId() {
  const user = await getCurrentUser()
  return user?.id ?? null
}

export async function getCurrentUser(): Promise<CachedNeonUser | null> {
  if (!isNeonAuthConfigured()) return null

  try {
    const cookieStore = await cookies()
    const sessionData = cookieStore.get(sessionDataCookieName)?.value
    if (!sessionData || !cookieSecret) return null

    const { payload } = await jwtVerify(
      sessionData,
      new TextEncoder().encode(cookieSecret)
    )

    const user = payload.user
    if (
      user &&
      typeof user === "object" &&
      "id" in user &&
      typeof user.id === "string"
    ) {
      return user as CachedNeonUser
    }

    if (typeof payload.sub === "string" && payload.sub !== "anonymous") {
      return { id: payload.sub }
    }

    return null
  } catch {
    return null
  }
}

export async function getMutableCurrentUserId() {
  if (!isNeonAuthConfigured()) return null

  try {
    const { data: session } = await auth.getSession()
    return session?.user?.id ?? null
  } catch (error) {
    console.error("Neon Auth getSession error:", error)
    return null
  }
}

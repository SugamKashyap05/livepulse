import type { NextRequest } from "next/server"
import { cookies, headers } from "next/headers"
import { validateAdminSession } from "@/lib/adminSessions"

export async function isAdminAuthorized(request?: NextRequest | Request): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false

  if (request) {
    const req = request as NextRequest
    const authHeader = req.headers?.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null
    if (bearerToken === adminSecret) return true

    const cookieToken = req.cookies?.get?.("admin_token")?.value
    if (cookieToken && validateAdminSession(cookieToken)) return true
    
    return false
  }

  // Server Action Context
  try {
    const headersList = await headers()
    const authHeader = headersList.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null
    if (bearerToken === adminSecret) return true

    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("admin_token")?.value
    if (cookieToken && validateAdminSession(cookieToken)) return true
  } catch (e) {
    // cookies() throws outside of Next.js Server contexts
  }

  return false
}

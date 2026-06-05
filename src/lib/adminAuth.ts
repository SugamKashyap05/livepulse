import type { NextRequest } from "next/server"
import { validateAdminSession } from "@/app/api/admin/auth/route"

export function isAdminAuthorized(request: NextRequest | Request): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false

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

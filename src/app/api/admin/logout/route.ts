import { NextResponse } from "next/server"
import { deleteAdminSession } from "@/lib/adminSessions"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const cookieToken = request.cookies.get("admin_token")?.value
  if (cookieToken) deleteAdminSession(cookieToken)

  const response = NextResponse.json({ success: true })
  response.cookies.set("admin_token", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
  })
  return response
}

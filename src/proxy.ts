import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/admin/login" || pathname === "/api/admin/auth") {
    return NextResponse.next()
  }

  if (!isAdminAuthorized(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = new URL("/admin/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}

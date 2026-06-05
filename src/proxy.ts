import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { auth, isNeonAuthConfigured } from "@/lib/auth"

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/auth" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next()
  }

  const userProtected = ["/profile", "/onboarding", "/bookmarks", "/settings"]
  if (userProtected.some((path) => pathname.startsWith(path))) {
    if (!isNeonAuthConfigured()) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      loginUrl.searchParams.set("error", "auth_not_configured")
      return NextResponse.redirect(loginUrl)
    }

    return auth.middleware({ loginUrl: "/login" })(request)
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
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
    "/bookmarks/:path*",
    "/settings/:path*",
  ],
}

import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin auth is not configured" },
      { status: 500 }
    )
  }

  const { password } = await request.json()
  if (password !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set("admin_token", adminSecret, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  })

  return response
}

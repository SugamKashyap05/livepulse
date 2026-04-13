import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "No URL" }, { status: 400 })
  }
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LivePulse/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 200 })
  }
}

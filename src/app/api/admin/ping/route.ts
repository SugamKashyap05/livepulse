import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { FEED_SOURCES } from "@/lib/sources"

async function getAllowedHostnames() {
  const dbSources = await prisma.feedSource.findMany({
    where: { enabled: true },
    select: { url: true },
  })
  const urls = dbSources.length > 0
    ? dbSources.map((source) => source.url)
    : FEED_SOURCES.map((source) => source.url)

  return new Set(urls.map((url) => new URL(url).hostname))
}

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "No URL" }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  const allowedHostnames = await getAllowedHostnames()

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    !allowedHostnames.has(parsedUrl.hostname)
  ) {
    return NextResponse.json(
      { error: "URL not in allowed sources" },
      { status: 403 }
    )
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LivePulse/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (error) {
    console.error("[admin ping] error:", error)
    return NextResponse.json({ ok: false, error: "An error occurred" }, { status: 200 })
  }
}

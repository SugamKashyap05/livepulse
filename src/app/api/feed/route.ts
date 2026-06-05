import { NextResponse } from "next/server"
import { getMutableCurrentUserId } from "@/lib/auth"
import { getPaginatedFeed, type FeedScope } from "@/lib/paginatedFeed"

export const dynamic = "force-dynamic"

const SCOPES: FeedScope[] = ["home", "topic", "search", "tag", "ai-news", "bookmarks"]

function isFeedScope(value: string | null): value is FeedScope {
  return !!value && SCOPES.includes(value as FeedScope)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scopeParam = searchParams.get("scope")

  if (!isFeedScope(scopeParam)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
  }

  const userId = await getMutableCurrentUserId()

  if (scopeParam === "bookmarks" && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const page = await getPaginatedFeed({
    scope: scopeParam,
    userId,
    topicSlug: searchParams.get("topic"),
    sentiment: searchParams.get("sentiment"),
    q: searchParams.get("q"),
    tag: searchParams.get("tag"),
    cursor: searchParams.get("cursor"),
  })

  return NextResponse.json(page)
}

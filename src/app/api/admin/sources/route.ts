import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"
import { ALL_TOPICS } from "@/lib/sources"

const REGIONS = [
  "global",
  "india",
  "uk",
  "us",
  "middleeast",
  "africa",
  "seasia",
  "latam",
  "eastasia",
]

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function normalizeSourceInput(body: Record<string, unknown>) {
  const name = String(body.name || "").trim()
  const url = String(body.url || "").trim()
  const topic = String(body.topic || "").trim().toLowerCase()
  const slug = String(body.slug || topic).trim().toLowerCase()
  const region = String(body.region || "global").trim().toLowerCase()
  const priority = Number(body.priority ?? 0)
  const validTopics = ALL_TOPICS.filter((topic) => topic.slug !== "all").map(
    (topic) => topic.slug
  )

  if (!name || !url || !topic) {
    return { error: "name, url, and topic are required" }
  }

  try {
    const parsedUrl = new URL(url)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { error: "url must use http or https" }
    }
  } catch {
    return { error: "url must be valid" }
  }

  if (!validTopics.includes(topic)) {
    return { error: "topic is invalid" }
  }

  if (!REGIONS.includes(region)) {
    return { error: "region is invalid" }
  }

  return {
    data: {
      name,
      url,
      topic,
      slug,
      region,
      priority: Number.isFinite(priority) ? Math.max(0, Math.min(10, priority)) : 0,
    },
  }
}

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized()

  const sources = await prisma.feedSource.findMany({
    orderBy: [{ topic: "asc" }, { priority: "desc" }, { name: "asc" }],
  })

  return NextResponse.json({ sources })
}

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized()

  const body = await request.json()
  const normalized = normalizeSourceInput(body)
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    const source = await prisma.feedSource.create({
      data: {
        ...normalized.data,
        enabled: Boolean(body.enabled ?? true),
      },
    })
    return NextResponse.json({ source }, { status: 201 })
  } catch (error) {
    console.error("[admin sources] error:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized()

  const body = await request.json()
  const id = String(body.id || "")
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const data: Record<string, string | number | boolean | null> = {}
  if ("enabled" in body) data.enabled = Boolean(body.enabled)
  if ("lastStatus" in body) data.lastStatus = body.lastStatus ? String(body.lastStatus) : null
  if ("failCount" in body) data.failCount = Number(body.failCount)

  const editableFields = ["name", "url", "topic", "slug", "region", "priority"]
  if (editableFields.some((field) => field in body)) {
    const current = await prisma.feedSource.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    const normalized = normalizeSourceInput({
      name: body.name ?? current.name,
      url: body.url ?? current.url,
      topic: body.topic ?? current.topic,
      slug: body.slug ?? current.slug,
      region: body.region ?? current.region,
      priority: body.priority ?? current.priority,
    })

    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    Object.assign(data, normalized.data)
  }

  const source = await prisma.feedSource.update({
    where: { id },
    data,
  })

  return NextResponse.json({ source })
}

export async function DELETE(request: Request) {
  if (!isAdminAuthorized(request)) return unauthorized()

  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const source = await prisma.feedSource.findUnique({ where: { id } })
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  const articleCount = await prisma.newsArticle.count({
    where: { source: source.name },
  })
  if (articleCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a source that has articles" },
      { status: 409 }
    )
  }

  await prisma.feedSource.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isAdminAuthorized } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const drafts = await prisma.newsArticle.findMany({
      where: {
        aiGenerated: true,
        published: false,
      },
      orderBy: {
        fetchedAt: "desc",
      },
    })
    return NextResponse.json(drafts)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

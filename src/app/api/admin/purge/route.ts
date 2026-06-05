import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { prisma } from "@/lib/db"

export async function DELETE(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawDays = parseInt(searchParams.get("days") || "3")
  const days = Number.isNaN(rawDays)
    ? 3
    : Math.max(1, Math.min(365, rawDays))
  const confirm = searchParams.get("confirm")

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    if (confirm !== "true") {
      const count = await prisma.newsArticle.count({
        where: {
          fetchedAt: { lt: cutoff },
          aiGenerated: false,
        },
      })
      return NextResponse.json({
        preview: true,
        wouldDelete: count,
        message: `Add ?confirm=true to delete ${count} articles`,
      })
    }

    const result = await prisma.newsArticle.deleteMany({
      where: {
        fetchedAt: { lt: cutoff },
        aiGenerated: false,
      },
    })
    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error("[admin purge] error:", error)
    return NextResponse.json(
      { success: false, error: "An error occurred" },
      { status: 500 }
    )
  }
}

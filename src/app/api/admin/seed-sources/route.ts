import { NextResponse } from "next/server"
import { isAdminAuthorized } from "@/lib/adminAuth"
import { seedFeedSources } from "@/lib/seedSources"

export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await seedFeedSources()
  return NextResponse.json({ success: true })
}

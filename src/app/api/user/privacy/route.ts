import { NextResponse } from "next/server"
import { auth, isNeonAuthConfigured } from "@/lib/auth"
import { prisma } from "@/lib/db"

const VALID_ACTIONS = ["toggle_personalization", "reset_profile"] as const
type PrivacyAction = (typeof VALID_ACTIONS)[number]

function isValidAction(value: unknown): value is PrivacyAction {
  return typeof value === "string" && VALID_ACTIONS.includes(value as PrivacyAction)
}

async function getSessionUserId(): Promise<string | null> {
  if (!isNeonAuthConfigured()) return null
  const { data: session } = await auth.getSession()
  return session?.user?.id ?? null
}

export async function POST(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { action?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!isValidAction(body.action)) {
    return NextResponse.json(
      { error: "Invalid action", validActions: VALID_ACTIONS },
      { status: 400 }
    )
  }

  if (body.action === "toggle_personalization") {
    const existing = await prisma.userProfile.findUnique({
      where: { userId },
      select: { personalizationEnabled: true },
    })

    const next = !(existing?.personalizationEnabled ?? true)

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        personalizationEnabled: next,
      },
      update: {
        personalizationEnabled: next,
      },
    })

    return NextResponse.json({
      success: true,
      personalizationEnabled: next,
    })
  }

  if (body.action === "reset_profile") {
    // Delete aggregated data only — raw events are append-only and preserved.
    await prisma.$transaction([
      prisma.userArticleContext.deleteMany({ where: { userId } }),
      prisma.userInterestProfile.deleteMany({ where: { userId } }),
    ])

    return NextResponse.json({
      success: true,
      message: "Profile aggregates reset. Raw event history preserved.",
    })
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 })
}

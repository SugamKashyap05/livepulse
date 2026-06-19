import { NextResponse } from "next/server"
import { getMutableCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

async function requireUserId() {
  const userId = await getMutableCurrentUserId()
  return userId
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile, counts] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { personalizationEnabled: true },
    }),
    getPersonalizationCounts(userId),
  ])

  return NextResponse.json({
    personalizationEnabled: profile?.personalizationEnabled ?? true,
    ...counts,
  })
}

export async function PATCH(req: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await req.json().catch(() => null)) as {
    personalizationEnabled?: unknown
  } | null
  if (typeof payload?.personalizationEnabled !== "boolean") {
    return NextResponse.json(
      { error: "personalizationEnabled boolean required" },
      { status: 400 }
    )
  }

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      personalizationEnabled: payload.personalizationEnabled,
    },
    update: {
      personalizationEnabled: payload.personalizationEnabled,
    },
  })

  return NextResponse.json({
    success: true,
    personalizationEnabled: payload.personalizationEnabled,
  })
}

export async function DELETE() {
  const userId = await requireUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [events, contexts, interestProfile] = await prisma.$transaction([
    prisma.userArticleEvent.deleteMany({ where: { userId } }),
    prisma.userArticleContext.deleteMany({ where: { userId } }),
    prisma.userInterestProfile.deleteMany({ where: { userId } }),
  ])

  return NextResponse.json({
    success: true,
    deleted: {
      events: events.count,
      articleContexts: contexts.count,
      interestProfiles: interestProfile.count,
    },
  })
}

async function getPersonalizationCounts(userId: string) {
  const [events, articleContexts, interestProfile] = await Promise.all([
    prisma.userArticleEvent.count({ where: { userId } }),
    prisma.userArticleContext.count({ where: { userId } }),
    prisma.userInterestProfile.count({ where: { userId } }),
  ])

  return {
    events,
    articleContexts,
    interestProfileExists: interestProfile > 0,
  }
}

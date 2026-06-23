import { NextResponse } from "next/server"
import { auth, isNeonAuthConfigured } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ALL_TOPICS } from "@/lib/sources"

const VALID_TOPICS = new Set(
  ALL_TOPICS.filter((topic) => topic.slug !== "all").map((topic) => topic.slug)
)

function normalizeTopics(topics: unknown) {
  if (!Array.isArray(topics)) return []

  return topics
    .map((topic) => String(topic).toLowerCase())
    .filter((topic) => VALID_TOPICS.has(topic))
}

async function getSessionUser() {
  if (!isNeonAuthConfigured()) return null

  try {
    const { data: session } = await auth.getSession()
    return session?.user ?? null
  } catch (error) {
    console.error("Neon Auth getSession error:", error)
    return null
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile, follows] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId: user.id },
    }),
    prisma.userTopicFollow.findMany({
      where: { userId: user.id },
      select: { topicSlug: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  return NextResponse.json({
    region: profile?.region ?? null,
    country: profile?.country ?? null,
    topics: follows.map((follow) => follow.topicSlug),
    onboarded: profile?.onboarded ?? false,
    personalizationEnabled: profile?.personalizationEnabled ?? true,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
  })
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { region, country, topics } = await req.json()
  const normalizedTopics = normalizeTopics(topics)

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      region: region ?? null,
      country: country ?? null,
      personalizationEnabled: true,
      onboarded: true,
    },
    update: {
      region: region ?? undefined,
      country: country ?? undefined,
      onboarded: true,
    },
  })

  if (Array.isArray(topics)) {
    await prisma.userTopicFollow.deleteMany({
      where: { userId: user.id },
    })

    if (normalizedTopics.length > 0) {
      await prisma.userTopicFollow.createMany({
        data: normalizedTopics.map((topicSlug) => ({
          userId: user.id,
          topicSlug,
        })),
        skipDuplicates: true,
      })
    }
  }

  return NextResponse.json({ success: true })
}

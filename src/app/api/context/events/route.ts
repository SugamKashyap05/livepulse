import { NextResponse } from "next/server"
import { getMutableCurrentUserId } from "@/lib/auth"
import { normalizeContextEvent, recordContextEvents } from "@/lib/contextEngine"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

type EventPayload = {
  anonymousId?: unknown
  events?: unknown
}

export async function POST(req: Request) {
  let payload: EventPayload

  try {
    payload = (await req.json()) as EventPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rawEvents = Array.isArray(payload.events) ? payload.events : []
  const events = rawEvents
    .map(normalizeContextEvent)
    .filter((event): event is NonNullable<typeof event> => Boolean(event))

  if (events.length === 0) {
    return NextResponse.json({ error: "No valid events" }, { status: 400 })
  }

  const anonymousId =
    typeof payload.anonymousId === "string" && payload.anonymousId.length <= 160
      ? payload.anonymousId
      : null

  const userId = await getMutableCurrentUserId()
  const profile = userId
    ? await prisma.userProfile.findUnique({
        where: { userId },
        select: { personalizationEnabled: true },
      })
    : null
  const effectiveUserId = profile?.personalizationEnabled === false ? null : userId

  const result = await recordContextEvents({
    userId: effectiveUserId,
    anonymousId,
    events,
  })

  return NextResponse.json({ success: true, ...result })
}

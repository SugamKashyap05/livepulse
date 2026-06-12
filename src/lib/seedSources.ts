import { prisma } from "@/lib/db"
import { VERIFIED_FEED_SOURCES } from "@/lib/feedSourceCatalog"

export async function seedFeedSources() {
  for (const source of VERIFIED_FEED_SOURCES) {
    await prisma.feedSource.upsert({
      where: { name: source.name },
      update: {
        url: source.url,
        topic: source.topic,
        slug: source.slug,
        region: source.region,
        priority: source.priority,
        enabled: true,
        fetchIntervalMinutes: 30,
        lastStatus: null,
        failCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
      create: {
        ...source,
        enabled: true,
        fetchIntervalMinutes: 30,
        lastStatus: null,
        failCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    })
  }

  console.log(`[LivePulse] Seeded ${VERIFIED_FEED_SOURCES.length} verified feed sources`)
}

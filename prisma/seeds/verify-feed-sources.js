const Parser = require("rss-parser")
const { PrismaClient } = require("@prisma/client")

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "LivePulse-NewsAggregator/1.0 (+https://livepulse.local/bot)",
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
  },
})

async function fetchFeedText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LivePulse-NewsAggregator/1.0 (+https://livepulse.local/bot)",
      Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function mapWithConcurrency(items, limit, worker) {
  const results = []
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker))
  return results
}

const CANDIDATES = [
  { name: "Google News Business", topic: "business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters Business", topic: "business", url: "https://news.google.com/rss/search?q=reuters+business&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Business", topic: "business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", region: "uk", priority: 9 },
  { name: "CNBC Top News", topic: "business", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", region: "us", priority: 8 },
  { name: "CNBC Business", topic: "business", url: "https://www.cnbc.com/id/10001147/device/rss/rss.html", region: "us", priority: 8 },
  { name: "MarketWatch Top Stories", topic: "business", url: "https://feeds.marketwatch.com/marketwatch/topstories/", region: "us", priority: 7 },
  { name: "Bloomberg Markets", topic: "business", url: "https://feeds.bloomberg.com/markets/news.rss", region: "global", priority: 7 },
  { name: "Financial Times", topic: "business", url: "https://www.ft.com/rss/home", region: "global", priority: 6 },

  { name: "Google News Climate", topic: "climate", url: "https://news.google.com/rss/search?q=climate+change&hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters Environment", topic: "climate", url: "https://news.google.com/rss/search?q=reuters+environment&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Science Environment", topic: "climate", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", region: "uk", priority: 9 },
  { name: "The Guardian Environment", topic: "climate", url: "https://www.theguardian.com/environment/rss", region: "global", priority: 8 },
  { name: "Google News NASA Climate", topic: "climate", url: "https://news.google.com/rss/search?q=NASA+climate+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Yale Climate Connections", topic: "climate", url: "https://yaleclimateconnections.org/feed/", region: "us", priority: 7 },
  { name: "Carbon Brief", topic: "climate", url: "https://www.carbonbrief.org/feed", region: "global", priority: 7 },
  { name: "Climate Home News", topic: "climate", url: "https://www.climatechangenews.com/feed", region: "global", priority: 7 },

  { name: "Google News Health", topic: "health", url: "https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters Health", topic: "health", url: "https://news.google.com/rss/search?q=reuters+health&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Health", topic: "health", url: "https://feeds.bbci.co.uk/news/health/rss.xml", region: "uk", priority: 9 },
  { name: "NPR Health", topic: "health", url: "https://feeds.npr.org/1128/rss.xml", region: "us", priority: 8 },
  { name: "Google News WHO Health", topic: "health", url: "https://news.google.com/rss/search?q=WHO+health+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Medical News Today", topic: "health", url: "https://news.google.com/rss/search?q=Medical+News+Today&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "Google News Harvard Health", topic: "health", url: "https://news.google.com/rss/search?q=Harvard+Health&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "NHS Digital", topic: "health", url: "https://digital.nhs.uk/feed/all-blog-feed.xml", region: "uk", priority: 6 },
  { name: "WHO News", topic: "health", url: "https://www.who.int/rss-feeds/news-english.xml", region: "global", priority: 8 },
  { name: "Healthline News", topic: "health", url: "https://www.healthline.com/rss/health-news", region: "global", priority: 7 },

  { name: "Google News India", topic: "india", url: "https://news.google.com/rss/headlines/section/geo/IN?hl=en-IN&gl=IN&ceid=IN:en", region: "india", priority: 10 },
  { name: "NDTV Top Stories", topic: "india", url: "https://feeds.feedburner.com/ndtvnews-top-stories", region: "india", priority: 9 },
  { name: "Times of India", topic: "india", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", region: "india", priority: 9 },
  { name: "The Hindu", topic: "india", url: "https://www.thehindu.com/feeder/default.rss", region: "india", priority: 8 },
  { name: "Indian Express", topic: "india", url: "https://indianexpress.com/feed", region: "india", priority: 8 },

  { name: "Google News Politics", topic: "politics", url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters Politics", topic: "politics", url: "https://news.google.com/rss/search?q=reuters+politics&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Politics", topic: "politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", region: "uk", priority: 8 },
  { name: "The Hill", topic: "politics", url: "https://thehill.com/feed/", region: "us", priority: 8 },
  { name: "NPR Politics", topic: "politics", url: "https://feeds.npr.org/1014/rss.xml", region: "us", priority: 8 },
  { name: "Google News AP Politics", topic: "politics", url: "https://news.google.com/rss/search?q=AP+politics&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "Politico", topic: "politics", url: "https://rss.politico.com/politics-news.xml", region: "us", priority: 8 },

  { name: "Google News Science", topic: "science", url: "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters Science", topic: "science", url: "https://news.google.com/rss/search?q=reuters+science&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "NASA Breaking News", topic: "science", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", region: "us", priority: 9 },
  { name: "ScienceDaily All", topic: "science", url: "https://www.sciencedaily.com/rss/all.xml", region: "global", priority: 8 },
  { name: "ScienceDaily Top Science", topic: "science", url: "https://www.sciencedaily.com/rss/top/science.xml", region: "global", priority: 8 },
  { name: "Phys.org", topic: "science", url: "https://phys.org/rss-feed/", region: "global", priority: 8 },
  { name: "New Scientist", topic: "science", url: "https://www.newscientist.com/feed/home/", region: "global", priority: 7 },
  { name: "Nature News", topic: "science", url: "https://www.nature.com/nature.rss", region: "global", priority: 6 },
  { name: "NPR Science", topic: "science", url: "https://feeds.npr.org/1007/rss.xml", region: "us", priority: 7 },
  { name: "The Wire Science", topic: "science", url: "https://science.thewire.in/feed/", region: "india", priority: 7 },

  { name: "Google News Sports", topic: "sports", url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters Sports", topic: "sports", url: "https://news.google.com/rss/search?q=reuters+sports&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Sport", topic: "sports", url: "https://feeds.bbci.co.uk/sport/rss.xml", region: "uk", priority: 9 },
  { name: "CBS Sports", topic: "sports", url: "https://www.cbssports.com/rss/headlines/", region: "us", priority: 8 },
  { name: "Sky Sports", topic: "sports", url: "https://www.skysports.com/rss/12040", region: "uk", priority: 8 },
  { name: "Google News ESPN Sports", topic: "sports", url: "https://news.google.com/rss/search?q=ESPN+sports+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "ESPN Top Headlines", topic: "sports", url: "https://www.espn.com/espn/rss/news", region: "us", priority: 8 },

  { name: "Google News Technology", topic: "technology", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "The Verge", topic: "technology", url: "https://www.theverge.com/rss/index.xml", region: "global", priority: 9 },
  { name: "TechCrunch", topic: "technology", url: "https://techcrunch.com/feed/", region: "us", priority: 9 },
  { name: "Ars Technica", topic: "technology", url: "https://feeds.arstechnica.com/arstechnica/index", region: "global", priority: 8 },
  { name: "Wired", topic: "technology", url: "https://www.wired.com/feed/rss", region: "us", priority: 8 },
  { name: "MIT Technology Review", topic: "technology", url: "https://www.technologyreview.com/feed/", region: "global", priority: 7 },
  { name: "Hacker News", topic: "technology", url: "https://hnrss.org/frontpage", region: "global", priority: 7 },
  { name: "Hacker News RSS", topic: "technology", url: "https://news.ycombinator.com/rss", region: "global", priority: 7 },
  { name: "VentureBeat", topic: "technology", url: "https://venturebeat.com/feed/", region: "us", priority: 7 },

  { name: "Google News World", topic: "world", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en&gl=US&ceid=US:en", region: "us", priority: 10 },
  { name: "Google News Reuters World", topic: "world", url: "https://news.google.com/rss/search?q=reuters+world+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC World", topic: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "uk", priority: 9 },
  { name: "Al Jazeera English", topic: "world", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "middleeast", priority: 8 },
  { name: "Google News AP World", topic: "world", url: "https://news.google.com/rss/search?q=AP+world+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Deutsche Welle", topic: "world", url: "https://rss.dw.com/xml/rss-en-all", region: "global", priority: 7 },
  { name: "France 24 English", topic: "world", url: "https://www.france24.com/en/rss", region: "global", priority: 7 },
  { name: "NPR World", topic: "world", url: "https://feeds.npr.org/1004/rss.xml", region: "us", priority: 7 },
  { name: "AP News", topic: "world", url: "https://openrss.org/feed/apnews.com/hub/ap-top-news", region: "us", priority: 8 },
  { name: "Reuters World", topic: "world", url: "https://openrss.org/feed/www.reuters.com/world/", region: "global", priority: 8 },
]

async function applyWorkingSources(working) {
  const prisma = new PrismaClient()
  const canonicalUrls = working.map((source) => source.url)

  try {
    let upserted = 0
    for (const source of working) {
      const matches = await prisma.feedSource.findMany({
        where: { OR: [{ url: source.url }, { name: source.name }] },
        select: { id: true, name: true, url: true },
      })

      const data = {
        name: source.name,
        url: source.url,
        topic: source.topic,
        slug: source.topic,
        region: source.region,
        priority: source.priority,
        enabled: true,
        fetchIntervalMinutes: 30,
        lastStatus: null,
        failCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      }

      const canonical =
        matches.find((match) => match.name === source.name) ??
        matches.find((match) => match.url === source.url)

      if (canonical) {
        const duplicates = matches.filter((match) => match.id !== canonical.id)
        for (const duplicate of duplicates) {
          await prisma.feedSource.update({
            where: { id: duplicate.id },
            data: {
              name:
                duplicate.name === source.name
                  ? `${duplicate.name} (disabled ${duplicate.id.slice(-6)})`
                  : duplicate.name,
              url:
                duplicate.url === source.url
                  ? `${duplicate.url}#disabled-${duplicate.id}`
                  : duplicate.url,
              enabled: false,
              lastStatus: "disabled",
              lastErrorMessage: `Disabled: merged into verified source ${source.name}.`,
            },
          })
        }

        await prisma.feedSource.update({ where: { id: canonical.id }, data })
      } else {
        await prisma.feedSource.create({ data })
      }
      upserted++
    }

    const disabled = await prisma.feedSource.updateMany({
      where: {
        url: { notIn: canonicalUrls },
        OR: [
          { lastStatus: "error" },
          { lastStatus: "disabled" },
          { enabled: false },
        ],
      },
      data: {
        enabled: false,
        lastStatus: "disabled",
        lastErrorMessage: "Disabled: not in the verified 2026-06-12 source set.",
      },
    })

    console.log(`Applied verified sources. Upserted: ${upserted}, parked old broken sources: ${disabled.count}`)
  } finally {
    await prisma.$disconnect()
  }
}

async function verifySource(source) {
  try {
    const xml = await fetchFeedText(source.url)
    const feed = await parser.parseString(xml)
    const itemCount = Array.isArray(feed.items) ? feed.items.length : 0
    if (itemCount === 0) {
      return { ...source, ok: false, error: "No feed items returned", itemCount }
    }
    return { ...source, ok: true, itemCount }
  } catch (error) {
    return {
      ...source,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      itemCount: 0,
    }
  }
}

async function main({ apply = process.argv.includes("--apply") } = {}) {
  const results = await mapWithConcurrency(CANDIDATES, 8, async (source) => {
    const result = await verifySource(source)
    console.log(`${result.ok ? "OK  " : "FAIL"} ${source.topic.padEnd(10)} ${source.name} (${result.itemCount})${result.error ? ` - ${result.error}` : ""}`)
    return result
  })

  const working = results.filter((result) => result.ok)
  const failed = results.filter((result) => !result.ok)
  const byTopic = working.reduce((acc, source) => {
    acc[source.topic] = (acc[source.topic] ?? 0) + 1
    return acc
  }, {})

  console.log("")
  console.log(`Working: ${working.length}`)
  console.log(`Failed: ${failed.length}`)
  console.log(JSON.stringify(byTopic, null, 2))
  console.log("")
  console.log(JSON.stringify(working.map(({ ok, itemCount, error, ...source }) => source), null, 2))

  if (apply) {
    if (failed.length > 0) {
      throw new Error("Refusing to apply because at least one candidate failed verification.")
    }
    await applyWorkingSources(working.map(({ ok, itemCount, error, ...source }) => source))
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { CANDIDATES, main }

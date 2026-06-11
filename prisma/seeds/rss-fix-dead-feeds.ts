{
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const REPLACEMENTS = {
  "https://www.who.int/rss-feeds/news-releases-en.xml":
    "https://news.google.com/rss/search?q=WHO+health+news&hl=en&gl=US&ceid=US:en",
  "https://www.medicalnewstoday.com/rss":
    "https://news.google.com/rss/search?q=Medical+News+Today&hl=en&gl=US&ceid=US:en",
  "https://www.eurekalert.org/rss.xml":
    "https://www.sciencedaily.com/rss/top/science.xml",
  "https://www.health.harvard.edu/blog/feed":
    "https://news.google.com/rss/search?q=Harvard+Health&hl=en&gl=US&ceid=US:en",
  "https://bleacherreport.com/articles/feed":
    "https://www.cbssports.com/rss/headlines/",
  "https://climate.nasa.gov/news/rss/":
    "https://news.google.com/rss/search?q=NASA+climate+news&hl=en&gl=US&ceid=US:en",
}

const DISABLE = [
  "https://feeds.reuters.com/reuters/businessNews",
  "https://feeds.reuters.com/reuters/environment",
  "https://feeds.reuters.com/reuters/healthNews",
  "https://feeds.reuters.com/Reuters/PoliticsNews",
  "https://feeds.reuters.com/reuters/scienceNews",
  "https://feeds.reuters.com/reuters/sportsNews",
  "https://feeds.reuters.com/Reuters/worldNews",
  "https://www.politico.com/rss/politicopicks.xml",
  "https://www.realclearpolitics.com/rss/politics.xml",
  "https://finance.yahoo.com/news/rssindex",
  "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC",
  "https://feeds.apnews.com/rss/world-news",
]

const ADD_NEW = [
  { name: "Google News Reuters Business", topic: "business", url: "https://news.google.com/rss/search?q=reuters+business&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Reuters World", topic: "world", url: "https://news.google.com/rss/search?q=reuters+world+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Reuters Health", topic: "health", url: "https://news.google.com/rss/search?q=reuters+health&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Reuters Politics", topic: "politics", url: "https://news.google.com/rss/search?q=reuters+politics&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Reuters Science", topic: "science", url: "https://news.google.com/rss/search?q=reuters+science&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Reuters Sports", topic: "sports", url: "https://news.google.com/rss/search?q=reuters+sports&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News AP World", topic: "world", url: "https://news.google.com/rss/search?q=AP+world+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "Google News ESPN Sports", topic: "sports", url: "https://news.google.com/rss/search?q=ESPN+sports+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "NPR Health", topic: "health", url: "https://feeds.npr.org/1128/rss.xml", region: "us", priority: 7 },
  { name: "NPR Science", topic: "science", url: "https://feeds.npr.org/1007/rss.xml", region: "us", priority: 7 },
  { name: "NPR World", topic: "world", url: "https://feeds.npr.org/1004/rss.xml", region: "us", priority: 7 },
]

const RESET = [
  "https://www.espn.com/espn/rss/news",
]

async function updateUrlSafely(oldUrl: string, newUrl: string) {
  const oldSource = await prisma.feedSource.findUnique({ where: { url: oldUrl } })
  if (!oldSource) return "missing"

  const existingReplacement = await prisma.feedSource.findUnique({
    where: { url: newUrl },
  })

  if (existingReplacement && existingReplacement.id !== oldSource.id) {
    await prisma.feedSource.update({
      where: { id: oldSource.id },
      data: {
        enabled: false,
        lastStatus: "disabled",
        lastErrorMessage: `Disabled: replacement already exists as ${existingReplacement.name}`,
      },
    })
    return "disabled-conflict"
  }

  await prisma.feedSource.update({
    where: { id: oldSource.id },
    data: {
      url: newUrl,
      enabled: true,
      lastStatus: null,
      failCount: 0,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  })
  return "replaced"
}

async function main() {
  const outcomes: Record<string, number> = {}

  for (const [oldUrl, newUrl] of Object.entries(REPLACEMENTS)) {
    const outcome = await updateUrlSafely(oldUrl, newUrl)
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
    console.log(`${outcome}: ${oldUrl}`)
  }

  const disabled = await prisma.feedSource.updateMany({
    where: { url: { in: DISABLE } },
    data: {
      enabled: false,
      lastStatus: "disabled",
      lastErrorMessage: "Disabled: feed blocked, discontinued, or not parseable as RSS.",
    },
  })
  console.log(`disabled: ${disabled.count}`)

  const reset = await prisma.feedSource.updateMany({
    where: { url: { in: RESET } },
    data: {
      enabled: true,
      lastStatus: null,
      failCount: 0,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  })
  console.log(`reset parser-fixed feeds: ${reset.count}`)

  let upserted = 0
  for (const source of ADD_NEW) {
    await prisma.feedSource.upsert({
      where: { url: source.url },
      create: {
        ...source,
        slug: source.topic,
        enabled: true,
        fetchIntervalMinutes: 30,
        failCount: 0,
        lastStatus: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
      update: {
        enabled: true,
        lastStatus: null,
        failCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    })
    upserted++
  }

  console.log(`upserted replacements: ${upserted}`)
  console.log(JSON.stringify(outcomes))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
}

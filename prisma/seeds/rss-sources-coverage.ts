{
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const SOURCES = [
  { name: "Google News Business", topic: "business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters Business", topic: "business", url: "https://news.google.com/rss/search?q=reuters+business&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Business Coverage", topic: "business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", region: "uk", priority: 8 },
  { name: "CNBC Top News", topic: "business", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", region: "us", priority: 8 },
  { name: "MarketWatch Top Stories", topic: "business", url: "https://feeds.marketwatch.com/marketwatch/topstories/", region: "us", priority: 7 },
  { name: "Yahoo Finance", topic: "business", url: "https://finance.yahoo.com/news/rssindex", region: "us", priority: 7 },

  { name: "Google News Climate", topic: "climate", url: "https://news.google.com/rss/search?q=climate+change&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters Environment", topic: "climate", url: "https://news.google.com/rss/search?q=reuters+environment&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Science Environment", topic: "climate", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", region: "uk", priority: 8 },
  { name: "The Guardian Environment Coverage", topic: "climate", url: "https://www.theguardian.com/environment/rss", region: "global", priority: 8 },
  { name: "Google News NASA Climate", topic: "climate", url: "https://news.google.com/rss/search?q=NASA+climate+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Yale Climate Connections", topic: "climate", url: "https://yaleclimateconnections.org/feed/", region: "us", priority: 7 },
  { name: "Carbon Brief Coverage", topic: "climate", url: "https://www.carbonbrief.org/feed", region: "global", priority: 8 },

  { name: "Google News Health", topic: "health", url: "https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters Health", topic: "health", url: "https://news.google.com/rss/search?q=reuters+health&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Health", topic: "health", url: "https://feeds.bbci.co.uk/news/health/rss.xml", region: "uk", priority: 8 },
  { name: "Google News WHO Health", topic: "health", url: "https://news.google.com/rss/search?q=WHO+health+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Google News Medical News Today", topic: "health", url: "https://news.google.com/rss/search?q=Medical+News+Today&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },
  { name: "NPR Health", topic: "health", url: "https://feeds.npr.org/1128/rss.xml", region: "us", priority: 7 },
  { name: "Google News Harvard Health", topic: "health", url: "https://news.google.com/rss/search?q=Harvard+Health&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },

  { name: "Google News Politics", topic: "politics", url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters Politics", topic: "politics", url: "https://news.google.com/rss/search?q=reuters+politics&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Politics Coverage", topic: "politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", region: "uk", priority: 8 },
  { name: "The Hill", topic: "politics", url: "https://thehill.com/feed/", region: "us", priority: 8 },
  { name: "NPR Politics Coverage", topic: "politics", url: "https://feeds.npr.org/1014/rss.xml", region: "us", priority: 8 },
  { name: "NPR Politics", topic: "politics", url: "https://feeds.npr.org/1014/rss.xml", region: "us", priority: 7 },
  { name: "Google News AP Politics", topic: "politics", url: "https://news.google.com/rss/search?q=AP+politics&hl=en&gl=US&ceid=US:en", region: "us", priority: 7 },

  { name: "Google News Science", topic: "science", url: "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters Science", topic: "science", url: "https://news.google.com/rss/search?q=reuters+science&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "NASA Breaking News Coverage", topic: "science", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", region: "us", priority: 8 },
  { name: "ScienceDaily All", topic: "science", url: "https://www.sciencedaily.com/rss/all.xml", region: "global", priority: 8 },
  { name: "Phys.org", topic: "science", url: "https://phys.org/rss-feed/", region: "global", priority: 7 },
  { name: "New Scientist Coverage", topic: "science", url: "https://www.newscientist.com/feed/home/", region: "global", priority: 7 },
  { name: "ScienceDaily Top Science", topic: "science", url: "https://www.sciencedaily.com/rss/top/science.xml", region: "global", priority: 7 },

  { name: "Google News Sports", topic: "sports", url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters Sports", topic: "sports", url: "https://news.google.com/rss/search?q=reuters+sports&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC Sport Coverage", topic: "sports", url: "https://feeds.bbci.co.uk/sport/rss.xml", region: "uk", priority: 8 },
  { name: "ESPN Top Headlines", topic: "sports", url: "https://www.espn.com/espn/rss/news", region: "us", priority: 8 },
  { name: "Sky Sports Coverage", topic: "sports", url: "https://www.skysports.com/rss/12040", region: "uk", priority: 7 },
  { name: "CBS Sports RSS", topic: "sports", url: "https://www.cbssports.com/rss/headlines/", region: "us", priority: 7 },

  { name: "Google News Technology", topic: "technology", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "TechCrunch Coverage", topic: "technology", url: "https://techcrunch.com/feed/", region: "us", priority: 8 },
  { name: "The Verge Coverage", topic: "technology", url: "https://www.theverge.com/rss/index.xml", region: "global", priority: 8 },
  { name: "Ars Technica Coverage", topic: "technology", url: "https://feeds.arstechnica.com/arstechnica/index", region: "global", priority: 8 },
  { name: "Wired", topic: "technology", url: "https://www.wired.com/feed/rss", region: "us", priority: 7 },
  { name: "MIT Technology Review Coverage", topic: "technology", url: "https://www.technologyreview.com/feed/", region: "global", priority: 7 },
  { name: "Hacker News RSS", topic: "technology", url: "https://news.ycombinator.com/rss", region: "global", priority: 7 },
  { name: "VentureBeat", topic: "technology", url: "https://venturebeat.com/feed/", region: "us", priority: 7 },

  { name: "Google News World", topic: "world", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "Google News Reuters World", topic: "world", url: "https://news.google.com/rss/search?q=reuters+world+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 9 },
  { name: "BBC World Coverage", topic: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "uk", priority: 8 },
  { name: "Al Jazeera English Coverage", topic: "world", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "middleeast", priority: 8 },
  { name: "Google News AP World", topic: "world", url: "https://news.google.com/rss/search?q=AP+world+news&hl=en&gl=US&ceid=US:en", region: "us", priority: 8 },
  { name: "Deutsche Welle", topic: "world", url: "https://rss.dw.com/xml/rss-en-all", region: "global", priority: 7 },
  { name: "France 24 English", topic: "world", url: "https://www.france24.com/en/rss", region: "global", priority: 7 },
]

async function main() {
  console.log(`Seeding ${SOURCES.length} feed sources across 8 topics...`)

  let created = 0
  let skipped = 0

  for (const source of SOURCES) {
    const existing = await prisma.feedSource.findFirst({
      where: {
        OR: [{ url: source.url }, { name: source.name }],
      },
      select: { id: true },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.feedSource.create({
      data: {
        ...source,
        slug: source.topic,
        enabled: true,
        fetchIntervalMinutes: 30,
        lastFetched: null,
        lastStatus: null,
        failCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    })
    created++
  }

  console.log(`Done. Created: ${created}, skipped: ${skipped}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
}

import { prisma } from "@/lib/db"

const INITIAL_SOURCES = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", topic: "world", slug: "world", region: "global", priority: 10 },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", topic: "world", slug: "world", region: "middleeast", priority: 9 },
  { name: "Reuters World", url: "https://openrss.org/feed/www.reuters.com/world/", topic: "world", slug: "world", region: "global", priority: 9 },
  { name: "AP News", url: "https://openrss.org/feed/apnews.com/hub/ap-top-news", topic: "world", slug: "world", region: "us", priority: 8 },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", topic: "technology", slug: "technology", region: "global", priority: 10 },
  { name: "TechCrunch", url: "https://techcrunch.com/feed", topic: "technology", slug: "technology", region: "us", priority: 9 },
  { name: "Hacker News", url: "https://hnrss.org/frontpage", topic: "technology", slug: "technology", region: "global", priority: 8 },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", topic: "technology", slug: "technology", region: "global", priority: 8 },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed", topic: "technology", slug: "technology", region: "global", priority: 7 },
  { name: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", topic: "india", slug: "india", region: "india", priority: 10 },
  { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", topic: "india", slug: "india", region: "india", priority: 10 },
  { name: "The Hindu", url: "https://www.thehindu.com/feeder/default.rss", topic: "india", slug: "india", region: "india", priority: 9 },
  { name: "Indian Express", url: "https://indianexpress.com/feed", topic: "india", slug: "india", region: "india", priority: 8 },
  { name: "CNBC Business", url: "https://www.cnbc.com/id/10001147/device/rss/rss.html", topic: "business", slug: "business", region: "us", priority: 10 },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", topic: "business", slug: "business", region: "uk", priority: 9 },
  { name: "Financial Times", url: "https://www.ft.com/rss/home", topic: "business", slug: "business", region: "global", priority: 9 },
  { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss", topic: "business", slug: "business", region: "global", priority: 8 },
  { name: "Science Daily", url: "https://www.sciencedaily.com/rss/all.xml", topic: "science", slug: "science", region: "global", priority: 10 },
  { name: "NASA", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", topic: "science", slug: "science", region: "global", priority: 9 },
  { name: "New Scientist", url: "https://www.newscientist.com/feed/home", topic: "science", slug: "science", region: "global", priority: 8 },
  { name: "Nature News", url: "https://www.nature.com/nature.rss", topic: "science", slug: "science", region: "global", priority: 8 },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", topic: "sports", slug: "sports", region: "uk", priority: 10 },
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", topic: "sports", slug: "sports", region: "us", priority: 9 },
  { name: "Sky Sports", url: "https://www.skysports.com/rss/12040", topic: "sports", slug: "sports", region: "uk", priority: 8 },
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml", topic: "health", slug: "health", region: "global", priority: 10 },
  { name: "Healthline News", url: "https://www.healthline.com/rss/health-news", topic: "health", slug: "health", region: "global", priority: 9 },
  { name: "NHS Digital", url: "https://digital.nhs.uk/feed/all-blog-feed.xml", topic: "health", slug: "health", region: "uk", priority: 8 },
  { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed", topic: "climate", slug: "climate", region: "global", priority: 10 },
  { name: "The Guardian Environment", url: "https://www.theguardian.com/environment/rss", topic: "climate", slug: "climate", region: "global", priority: 9 },
  { name: "Climate Home News", url: "https://www.climatechangenews.com/feed", topic: "climate", slug: "climate", region: "global", priority: 8 },
  { name: "BBC Politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", topic: "politics", slug: "politics", region: "uk", priority: 10 },
  { name: "Politico", url: "https://rss.politico.com/politics-news.xml", topic: "politics", slug: "politics", region: "us", priority: 9 },
  { name: "The Wire Science", url: "https://science.thewire.in/feed/", topic: "science", slug: "science", region: "india", priority: 8 },
]

export async function seedFeedSources() {
  for (const source of INITIAL_SOURCES) {
    await prisma.feedSource.upsert({
      where: { name: source.name },
      update: {
        url: source.url,
        topic: source.topic,
        slug: source.slug,
        region: source.region,
        priority: source.priority,
      },
      create: source,
    })
  }

  console.log(`[LivePulse] Seeded ${INITIAL_SOURCES.length} feed sources`)
}

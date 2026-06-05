import { FeedSource } from "@/types/news"

export const FEED_SOURCES: FeedSource[] = [
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    topic: "world",
    slug: "world",
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    topic: "world",
    slug: "world",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    topic: "technology",
    slug: "technology",
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed",
    topic: "technology",
    slug: "technology",
  },
  {
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    topic: "technology",
    slug: "technology",
  },
  {
    name: "NDTV",
    url: "https://feeds.feedburner.com/ndtvnews-top-stories",
    topic: "india",
    slug: "india",
  },
  {
    name: "Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    topic: "india",
    slug: "india",
  },
  {
    name: "CNBC Business",
    url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    topic: "business",
    slug: "business",
  },
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    topic: "business",
    slug: "business",
  },
  {
    name: "Science Daily",
    url: "https://www.sciencedaily.com/rss/all.xml",
    topic: "science",
    slug: "science",
  },
  {
    name: "NASA",
    url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
    topic: "science",
    slug: "science",
  },
  {
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
    topic: "sports",
    slug: "sports",
  },
  {
    name: "CBS Sports",
    url: "https://www.cbssports.com/rss/headlines/",
    topic: "sports",
    slug: "sports",
  },
]

export interface AreaTopic {
  label: string
  slug: string
}

export const ALL_TOPICS: AreaTopic[] = [
  { label: "All", slug: "all" },
  { label: "World", slug: "world" },
  { label: "Technology", slug: "technology" },
  { label: "India", slug: "india" },
  { label: "Business", slug: "business" },
  { label: "Science", slug: "science" },
  { label: "Sports", slug: "sports" },
  { label: "Health", slug: "health" },
  { label: "Climate", slug: "climate" },
  { label: "Politics", slug: "politics" },
]

import { FeedSource } from "@/types/news"

export const FEED_SOURCES: FeedSource[] = [
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    topic: "World",
    slug: "world",
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    topic: "World",
    slug: "world",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    topic: "Technology",
    slug: "technology",
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed",
    topic: "Technology",
    slug: "technology",
  },
  {
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    topic: "Technology",
    slug: "technology",
  },
  {
    name: "NDTV",
    url: "https://feeds.feedburner.com/ndtvnews-top-stories",
    topic: "India",
    slug: "india",
  },
  {
    name: "Times of India",
    url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    topic: "India",
    slug: "india",
  },
  {
    name: "CNBC Business",
    url: "https://search.cnbc.com/rs/search/all/rss.nwz",
    topic: "Business",
    slug: "business",
  },
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    topic: "Business",
    slug: "business",
  },
  {
    name: "Science Daily",
    url: "https://www.sciencedaily.com/rss/all.xml",
    topic: "Science",
    slug: "science",
  },
  {
    name: "NASA",
    url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
    topic: "Science",
    slug: "science",
  },
  {
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
    topic: "Sports",
    slug: "sports",
  },
  {
    name: "ESPN",
    url: "https://www.espn.com/espn/rss/news",
    topic: "Sports",
    slug: "sports",
  },
]

export const ALL_TOPICS = [
  { label: "All", slug: "all" },
  { label: "World", slug: "world" },
  { label: "Technology", slug: "technology" },
  { label: "India", slug: "india" },
  { label: "Business", slug: "business" },
  { label: "Science", slug: "science" },
  { label: "Sports", slug: "sports" },
]

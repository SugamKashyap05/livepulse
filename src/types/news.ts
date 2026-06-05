export interface NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  source: string
  topic: string
  image?: string
  summary?: string
  sentiment?: string
  aiTags?: string
  aiGenerated?: boolean
  isRead?: boolean
  isBookmarked?: boolean
}

export interface FeedSource {
  name: string
  url: string
  topic: string
  slug: string
  region?: string
  enabled?: boolean
  priority?: number
}

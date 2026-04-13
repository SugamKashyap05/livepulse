export interface NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  source: string
  topic: string
  image?: string
}

export interface FeedSource {
  name: string
  url: string
  topic: string
  slug: string
}

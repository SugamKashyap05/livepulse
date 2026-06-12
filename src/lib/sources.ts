import type { FeedSource } from "@/types/news"
import { VERIFIED_FEED_SOURCES } from "@/lib/feedSourceCatalog"

export const FEED_SOURCES: FeedSource[] = VERIFIED_FEED_SOURCES

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

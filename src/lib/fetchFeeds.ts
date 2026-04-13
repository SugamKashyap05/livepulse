import Parser from "rss-parser"
import { formatDistanceToNow } from "date-fns"
import { FEED_SOURCES } from "@/lib/sources"
import { NewsItem } from "@/types/news"
import crypto from "crypto"

function makeParser() {
  return new Parser({
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
    },
    customFields: {
      item: [
        ["media:content", "mediaContent"],
        ["media:thumbnail", "mediaThumbnail"],
        ["enclosure", "enclosure"],
      ],
    },
  })
}

function extractImage(item: any): string | undefined {
  if (item.mediaContent?.$.url) return item.mediaContent.$.url
  if (item.mediaThumbnail?.$.url) return item.mediaThumbnail.$.url
  if (item.enclosure?.url) return item.enclosure.url
  const match = item.content?.match(/<img[^>]+src=["']([^"']+)["']/)
  if (match) return match[1]
  return undefined
}

function cleanDescription(raw: string | undefined): string {
  if (!raw) return ""
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim()
    .slice(0, 200)
}

async function fetchWithFallback(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      },
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSingleFeed(
  source: (typeof FEED_SOURCES)[0]
): Promise<NewsItem[]> {
  try {
    const parser = makeParser()
    let feed

    try {
      feed = await parser.parseURL(source.url)
    } catch {
      const xml = await fetchWithFallback(source.url)
      feed = await parser.parseString(xml)
    }

    return feed.items.slice(0, 15).map((item: any) => ({
      id: crypto
        .createHash("md5")
        .update(item.link || item.title || Math.random().toString())
        .digest("hex"),
      title: item.title?.trim() || "No title",
      description: cleanDescription(item.contentSnippet || item.content),
      link: item.link || "#",
      pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      source: source.name,
      topic: source.topic,
      image: extractImage(item),
    }))
  } catch (error) {
    console.error(`[LivePulse] Failed: ${source.name}`, error)
    return []
  }
}

export async function fetchAllFeeds(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map((source) => fetchSingleFeed(source))
  )

  const allItems = results
    .filter(
      (r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value)

  const seen = new Set<string>()
  return allItems.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export async function fetchFeedsByTopic(slug: string): Promise<NewsItem[]> {
  const all = await fetchAllFeeds()
  if (slug === "all") return all
  return all.filter(
    (item) => item.topic.toLowerCase() === slug.toLowerCase()
  )
}

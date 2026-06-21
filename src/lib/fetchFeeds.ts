import Parser from "rss-parser"
import { FEED_SOURCES } from "@/lib/sources"
import { NewsItem } from "@/types/news"
import crypto from "crypto"
import { decodeHtmlEntities, sanitizeAiText } from "@/lib/textSafety"

type SourceInput = {
  name: string
  url: string
  topic: string
  slug: string
}

type FeedSourceResult = {
  source: SourceInput
  articles: NewsItem[]
  ok: boolean
  error?: string
}

type FeedItem = {
  title?: string
  link?: string
  content?: string
  contentSnippet?: string
  pubDate?: string
  isoDate?: string
  mediaContent?: { $?: { url?: string } }
  mediaThumbnail?: { $?: { url?: string } }
  enclosure?: { url?: string }
}

function makeParser() {
  return new Parser({
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
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

function extractImage(item: FeedItem): string | undefined {
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url
  if (item.enclosure?.url) return item.enclosure.url
  const match = item.content?.match(/<img[^>]+src=["']([^"']+)["']/)
  if (match) return match[1]
  return undefined
}

export function cleanDescription(raw: string | undefined): string {
  return sanitizeAiText(raw, 500)
}

function cleanTitle(raw: string | undefined): string {
  if (!raw) return "No title"

  let text = raw
  text = decodeHtmlEntities(text)
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/[<>]/g, "")
  text = sanitizeAiText(text, 300)

  return text.replace(/\s+/g, " ").trim() || "No title"
}

function normalizePubDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString()

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString()
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function canonicalizeLink(raw: string | undefined): string {
  if (!raw) return "#"

  const trimmed = raw.trim()
  try {
    const url = new URL(trimmed)
    url.hash = ""
    for (const key of Array.from(url.searchParams.keys())) {
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid", "cmpid", "cid", "ref"].includes(
          lowerKey
        )
      ) {
        url.searchParams.delete(key)
      }
    }
    return url.toString().replace(/\/$/, "")
  } catch {
    return trimmed
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

async function fetchWithFallback(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function parseFeed(source: SourceInput) {
  const parser = makeParser()
  const xml = await fetchWithFallback(source.url)
  
  if (xml.trim().toLowerCase().startsWith('<!doctype html') || xml.trim().toLowerCase().startsWith('<html')) {
    throw new Error('Bot blocked by Cloudflare or firewall (Client Challenge)')
  }
  
  return parser.parseString(xml)
}

async function fetchSingleFeed(source: SourceInput): Promise<NewsItem[]> {
  const feed = await parseFeed(source)

  return feed.items.slice(0, 15).map((item: FeedItem) => {
    const title = cleanTitle(item.title)
    const link = canonicalizeLink(item.link)

    return {
      id: crypto
        .createHash("md5")
        .update(link !== "#" ? link : title)
        .digest("hex"),
      title,
      description: cleanDescription(item.contentSnippet || item.content),
      link,
      pubDate: normalizePubDate(item.pubDate),
      source: source.name,
      topic: source.topic,
      image: extractImage(item),
    }
  })
}

async function fetchSingleFeedResult(
  source: SourceInput
): Promise<FeedSourceResult> {
  try {
    const articles = await fetchSingleFeed(source)
    return { source, articles, ok: true }
  } catch (error) {
    console.warn(
      `[LivePulse] Feed failed: ${source.name} - ${getErrorMessage(error)}`
    )
    return { source, articles: [], ok: false, error: getErrorMessage(error) }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }

  const workerCount = Math.min(Math.max(limit, 1), items.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))
  return results
}

export async function fetchAllFeeds(): Promise<NewsItem[]> {
  return fetchFeedsFromSources(FEED_SOURCES)
}

export async function fetchFeedsFromSources(
  sources: SourceInput[]
): Promise<NewsItem[]> {
  const { articles } = await fetchFeedsWithStatus(sources)
  return articles
}

export async function fetchFeedsWithStatus(sources: SourceInput[]): Promise<{
  articles: NewsItem[]
  successNames: string[]
  failedNames: string[]
  failedSources: { name: string; error: string }[]
}> {
  const results = await mapWithConcurrency(
    sources,
    4,
    (source) => fetchSingleFeedResult(source)
  )

  const allItems = results.flatMap((result) => result.articles)

  const seenLinks = new Set<string>()
  const seenTitles = new Set<string>()
  const articles = allItems.filter((item) => {
    const linkKey = item.link.toLowerCase()
    const normalizedTitle = normalizeTitle(item.title)
    const titleKey = `${item.topic.toLowerCase()}:${normalizedTitle}`

    if (seenLinks.has(linkKey)) return false
    if (normalizedTitle.length > 20 && seenTitles.has(titleKey)) return false

    seenLinks.add(linkKey)
    if (normalizedTitle.length > 20) seenTitles.add(titleKey)
    return true
  })

  return {
    articles,
    successNames: results
      .filter((result) => result.ok)
      .map((result) => result.source.name),
    failedNames: results
      .filter((result) => !result.ok)
      .map((result) => result.source.name),
    failedSources: results
      .filter((result) => !result.ok)
      .map((result) => ({
        name: result.source.name,
        error: (result.error ?? "Unknown feed error").slice(0, 500),
      })),
  }
}

export async function fetchFeedsByTopic(slug: string): Promise<NewsItem[]> {
  const all = await fetchAllFeeds()
  if (slug === "all") return all
  return all.filter(
    (item) => item.topic.toLowerCase() === slug.toLowerCase()
  )
}

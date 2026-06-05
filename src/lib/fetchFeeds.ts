import Parser from "rss-parser"
import { FEED_SOURCES } from "@/lib/sources"
import { NewsItem } from "@/types/news"
import crypto from "crypto"

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
}

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

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/gi,
  /system\s*prompt/gi,
  /\[INST\]/gi,
  /<\|.*?\|>/g,
  /you\s+are\s+now/gi,
  /disregard\s+(all\s+)?previous/gi,
  /new\s+instructions?:/gi,
  /override\s+(the\s+)?system/gi,
]

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
}

function stripInjectionPatterns(text: string): string {
  let clean = text
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, "[redacted]")
  }
  return clean
}

export function cleanDescription(raw: string | undefined): string {
  if (!raw) return ""

  let text = raw
  text = decodeHtmlEntities(text)
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/[<>]/g, "")
  text = stripInjectionPatterns(text)

  return text.replace(/\s+/g, " ").trim().slice(0, 500)
}

function cleanTitle(raw: string | undefined): string {
  if (!raw) return "No title"

  let text = raw
  text = decodeHtmlEntities(text)
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/[<>]/g, "")
  text = stripInjectionPatterns(text)

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

async function parseFeed(source: SourceInput) {
  const parser = makeParser()

  try {
    return await parser.parseURL(source.url)
  } catch {
    const xml = await fetchWithFallback(source.url)
    return parser.parseString(xml)
  }
}

async function fetchSingleFeed(source: SourceInput): Promise<NewsItem[]> {
  const feed = await parseFeed(source)

  return feed.items.slice(0, 15).map((item: any) => {
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
    return { source, articles: [], ok: false }
  }
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
}> {
  const results = await Promise.all(
    sources.map((source) => fetchSingleFeedResult(source))
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
  }
}

export async function fetchFeedsByTopic(slug: string): Promise<NewsItem[]> {
  const all = await fetchAllFeeds()
  if (slug === "all") return all
  return all.filter(
    (item) => item.topic.toLowerCase() === slug.toLowerCase()
  )
}

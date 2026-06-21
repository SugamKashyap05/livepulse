import { describe, it, expect, vi, beforeEach } from "vitest"
import { scoreContextEvent, normalizeContextEvent, rankArticlesForUser } from "./contextEngine"
import { prisma } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  prisma: {
    userArticleContext: { findMany: vi.fn() },
    userInterestProfile: { findUnique: vi.fn() },
    userProfile: { findUnique: vi.fn() },
    userArticleEvent: { findMany: vi.fn() },
  }
}))

describe("contextEngine", () => {
  describe("scoreContextEvent", () => {
    it("returns base score for basic events", () => {
      expect(scoreContextEvent({ type: "impression" })).toBe(0.12)
      expect(scoreContextEvent({ type: "click" })).toBe(2)
      expect(scoreContextEvent({ type: "read" })).toBe(2.5)
      expect(scoreContextEvent({ type: "like" })).toBe(6)
      expect(scoreContextEvent({ type: "hide" })).toBe(-10)
    })

    it("calculates dwell score based on duration and scroll depth", () => {
      expect(scoreContextEvent({ type: "dwell", durationMs: 15000, scrollDepth: 0.5 })).toBe(0.5 + 0.5) // 1.0
      expect(scoreContextEvent({ type: "dwell", durationMs: 30000, scrollDepth: 1.0 })).toBe(1.0 + 1.0) // 2.0
      expect(scoreContextEvent({ type: "dwell", durationMs: 120000, scrollDepth: 1.5 })).toBe(4.0 + 1.2) // max 5.2
    })
  })

  describe("normalizeContextEvent", () => {
    it("returns null for invalid inputs", () => {
      expect(normalizeContextEvent(null)).toBeNull()
      expect(normalizeContextEvent("string")).toBeNull()
      expect(normalizeContextEvent({})).toBeNull()
      expect(normalizeContextEvent({ type: "click" })).toBeNull()
      expect(normalizeContextEvent({ articleId: "123", type: "invalid" })).toBeNull()
    })

    it("normalizes a valid event", () => {
      const input = {
        articleId: "art-1",
        type: "dwell",
        durationMs: 15000,
        scrollDepth: 0.5,
        surface: "feed",
        source: "cnn",
        sessionId: "sess-1",
      }
      const normalized = normalizeContextEvent(input)
      expect(normalized).toEqual({
        articleId: "art-1",
        type: "dwell",
        value: undefined,
        durationMs: 15000,
        visibleMs: undefined,
        scrollDepth: 0.5,
        feedScope: undefined,
        feedPosition: undefined,
        surface: "feed",
        source: "cnn",
        sessionId: "sess-1",
        pageViewId: undefined,
        context: undefined,
        occurredAt: undefined,
      })
    })

    it("clamps numeric values", () => {
      const input = {
        articleId: "art-1",
        type: "click",
        value: 5000,
        durationMs: -100,
        scrollDepth: 2.5,
      }
      const normalized = normalizeContextEvent(input)
      expect(normalized?.value).toBe(1000)
      expect(normalized?.durationMs).toBe(0)
      expect(normalized?.scrollDepth).toBe(1)
    })
  })

  describe("rankArticlesForUser", () => {
    beforeEach(() => {
      vi.clearAllMocks()
      // Default mock implementations to return neutral/empty data
      vi.mocked(prisma.userArticleContext.findMany).mockResolvedValue([])
      vi.mocked(prisma.userInterestProfile.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({ personalizationEnabled: true } as never)
      vi.mocked(prisma.userArticleEvent.findMany).mockResolvedValue([])
    })

    it("returns articles unranked if no userId or fewer than 2 articles", async () => {
      const articles = [{ id: "1", topic: "tech", source: "cnn", pubDate: new Date() }]
      const result = await rankArticlesForUser(articles, null, null)
      expect(result).toEqual(articles)
    })

    it("returns articles unranked if personalization is disabled", async () => {
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({ personalizationEnabled: false } as never)
      const articles = [
        { id: "1", topic: "tech", source: "cnn", pubDate: new Date() },
        { id: "2", topic: "sports", source: "bbc", pubDate: new Date() }
      ]
      const result = await rankArticlesForUser(articles, "user-1", null)
      expect(result).toEqual(articles)
      expect(prisma.userArticleContext.findMany).toHaveBeenCalled()
    })

    it("ranks based on topic weights and exponential decay", async () => {
      const now = Date.now()
      const pubDateNew = new Date(now - 1000 * 60 * 60) // 1 hour old
      const pubDateOld = new Date(now - 1000 * 60 * 60 * 48) // 48 hours old

      // Profile highly prefers sports
      vi.mocked(prisma.userInterestProfile.findUnique).mockResolvedValue({
        id: "profile-1",
        userId: "user-1",
        topicWeights: { sports: 10, tech: -5 },
        sourceWeights: {},
        tagWeights: {},
        lastEventAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const articles = [
        { id: "tech-new", topic: "tech", source: "wired", pubDate: pubDateNew },
        { id: "sports-old", topic: "sports", source: "espn", pubDate: pubDateOld },
        { id: "sports-new", topic: "sports", source: "espn", pubDate: pubDateNew },
      ]

      const result = await rankArticlesForUser(articles, "user-1", null)
      
      // Expected order: 
      // 1. sports-new (high topic + high freshness)
      // 2. tech-new (negative topic + high freshness)
      // 3. sports-old (high topic + low freshness)
      expect(result.length).toBe(3)
      expect(result[0].id).toBe("sports-new")
      expect(result[1].id).toBe("tech-new")
      expect(result[2].id).toBe("sports-old")
    })

    it("boosts topics based on session events", async () => {
      const pubDate = new Date()

      // Avoid cold start so exploration boost (which relies on index) doesn't interfere
      vi.mocked(prisma.userInterestProfile.findUnique).mockResolvedValue({
        id: "profile-2",
        userId: "user-1",
        topicWeights: { other: 1 },
        sourceWeights: {},
        tagWeights: {},
        lastEventAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(prisma.userArticleEvent.findMany).mockResolvedValue([
        { type: "click", durationMs: null, scrollDepth: null, article: { topic: "tech" } },
        { type: "read", durationMs: 120000, scrollDepth: 1, article: { topic: "tech" } },
      ] as never)

      const articles = [
        { id: "sports", topic: "sports", source: "espn", pubDate },
        { id: "tech", topic: "tech", source: "wired", pubDate },
      ]

      const result = await rankArticlesForUser(articles, "user-1", "session-1")
      
      // Tech should win due to session boost despite no interest profile
      expect(result[0].id).toBe("tech")
      expect(result[1].id).toBe("sports")
    })

    it("applies MMR diversity penalty to repeated topics and sources", async () => {
      const pubDate = new Date()
      // Interest profile prefers tech
      vi.mocked(prisma.userInterestProfile.findUnique).mockResolvedValue({
        id: "profile-3",
        userId: "user-1",
        topicWeights: { tech: 10, science: 5, space: 1 },
        sourceWeights: { wired: 5 },
        tagWeights: {},
        lastEventAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const articles = [
        { id: "tech-1", topic: "tech", source: "wired", pubDate },
        { id: "tech-2", topic: "tech", source: "wired", pubDate },
        { id: "tech-3", topic: "tech", source: "wired", pubDate },
        { id: "science-1", topic: "science", source: "nature", pubDate },
        { id: "space-1", topic: "space", source: "nasa", pubDate },
      ]

      const result = await rankArticlesForUser(articles, "user-1", null)
      
      // Due to MMR (0.8^k for topic, 0.9^k for source), the second and third tech/wired 
      // articles will be heavily penalized, allowing science and space to rise up.
      expect(result[0].id).toBe("tech-1")
      // The exact second article depends on the penalty math, but science-1 should easily beat tech-2
      expect(result[1].id).toBe("science-1")
    })
  })
})

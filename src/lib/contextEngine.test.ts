import { describe, it, expect } from "vitest"
import { scoreContextEvent, normalizeContextEvent } from "./contextEngine"

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
      // Base score for dwell is 0. 
      // durationScore = min(durationMs / 30000, 4)
      // depthScore = min(scrollDepth, 1.2)
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
      expect(normalizeContextEvent({ type: "click" })).toBeNull() // missing articleId
      expect(normalizeContextEvent({ articleId: "123", type: "invalid" })).toBeNull() // invalid type
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
        value: 5000, // max 1000
        durationMs: -100, // min 0
        scrollDepth: 2.5, // max 1
      }
      const normalized = normalizeContextEvent(input)
      expect(normalized?.value).toBe(1000)
      expect(normalized?.durationMs).toBe(0)
      expect(normalized?.scrollDepth).toBe(1)
    })
  })
})

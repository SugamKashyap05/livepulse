import { classifyChatIntent } from "./intent-classifier"
import { describe, it, expect } from "vitest"

describe("classifyChatIntent", () => {
  it("should classify meta questions correctly", () => {
    const metaQueries = [
      "what am I reading?",
      "what news am i reading right now",
      "what is this article about",
      "what is this news about",
      "what page am i on", // edge case, not matched by default unless we add it. Wait, my regex catches 'what is this page about'
      "summarize this please",
      "give me a summary of this",
      "who wrote this?",
      "when was this published?",
      "what is the topic of this article",
      "tell me about this article",
      "what's this article about?",
      "is this article biased?",
      "how long is this article",
      "what does this article say",
      "give me the gist",
      "What AM I reading", // Case insensitivity
      "what this aritcel tell complete story", // the specific typo reported
      "whole story",
      "what does this artical tell",
      "summerize the articel for me"
    ]

    for (const q of metaQueries) {
      expect(classifyChatIntent(q)).toBe("meta")
    }
  })

  it("should classify factual questions correctly", () => {
    const factualQueries = [
      "why did the stock market crash?",
      "how did the election turn out?",
      "who is the president of France?",
      "where did the event take place?",
      "when did they announce the merger?",
      "what happened to the missing ship?",
      "explain the new tax policy",
      "what are the main reasons for this",
      "tell me why the sky is blue",
      "who did the CEO replace?",
      "what is the capital of Japan?",
      "how many people attended?",
      "can you explain quantum mechanics",
      "why are interest rates rising",
      "where is the nearest hospital"
    ]

    for (const q of factualQueries) {
      expect(classifyChatIntent(q)).toBe("factual")
    }
  })

  it("should classify ambiguous questions correctly", () => {
    const ambiguousQueries = [
      "yes",
      "no",
      "hello",
      "I agree with that",
      "that's interesting",
      "what do you mean by that", // "what" doesn't strictly follow factual or meta pattern
      "can you tell me more",
      "I don't understand"
    ]

    for (const q of ambiguousQueries) {
      expect(classifyChatIntent(q)).toBe("ambiguous")
    }
  })

  it("should classify cross-article questions correctly", () => {
    const crossArticleQueries = [
      "is there any more news on f1",
      "any other news",
      "what else is happening",
      "any updates on the election",
      "what's the latest on this topic",
      "more articles on this",
      "any news on the World Cup"
    ]

    for (const q of crossArticleQueries) {
      expect(classifyChatIntent(q)).toBe("cross-article")
    }
  })

  it("should handle precedence collisions (cross-article wins over meta)", () => {
    // "news" can trigger meta patterns like "what is this news about", 
    // so we need to ensure cross-article patterns are checked first.
    const collisionQueries = [
      "is there any more news about this article", // "more news" vs "this article"
      "any updates on what this news is about"     // "any updates on" vs "what this news"
    ]

    for (const q of collisionQueries) {
      expect(classifyChatIntent(q)).toBe("cross-article")
    }
  })

  it("should guard against false positives (factual containing 'more')", () => {
    const falsePositiveQueries = [
      "how many more people attended?",
      "tell me more about why he said that",
      "explain more about the new tax policy"
    ]

    for (const q of falsePositiveQueries) {
      // These should NOT match cross-article, they might be factual or ambiguous
      expect(classifyChatIntent(q)).not.toBe("cross-article")
    }
  })
})

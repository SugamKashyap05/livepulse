import { scoreContextEvent, ContextEventInput, normalizeContextEvent } from "../lib/contextEngine"

async function runTests() {
  console.log("Running QA Tests for LivePulse Context Engine")
  let passed = 0
  let failed = 0

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`)
      passed++
    } else {
      console.error(`❌ FAIL: ${message}`)
      failed++
    }
  }

  // Test Event Scoring
  const impressionScore = scoreContextEvent({ type: "impression" } as ContextEventInput)
  assert(impressionScore === 0.12, `Impression score should be 0.12, got ${impressionScore}`)

  const clickScore = scoreContextEvent({ type: "click" } as ContextEventInput)
  assert(clickScore === 2, `Click score should be 2, got ${clickScore}`)

  const dwellScore = scoreContextEvent({ type: "dwell", durationMs: 15000, scrollDepth: 0.5 } as ContextEventInput)
  // (15000 / 30000) + 0.5 = 0.5 + 0.5 = 1.0
  assert(dwellScore === 1.0, `Dwell score for 15s/50% scroll should be 1.0, got ${dwellScore}`)

  const shareScore = scoreContextEvent({ type: "share" } as ContextEventInput)
  assert(shareScore === 5, `Share score should be 5, got ${shareScore}`)

  const hideScore = scoreContextEvent({ type: "hide" } as ContextEventInput)
  assert(hideScore === -10, `Hide score should be -10, got ${hideScore}`)

  // Test Event Normalization
  const validEvent = normalizeContextEvent({
    articleId: "123",
    type: "dwell",
    durationMs: 40000, // Should be clamped to max score internally, but normalization just clamps to 24h
    scrollDepth: 2.5, // Should be clamped to 1.0
  })

  assert(validEvent !== null, "Normalizer should accept valid event")
  assert(validEvent?.scrollDepth === 1.0, `Normalizer should clamp scrollDepth to 1.0, got ${validEvent?.scrollDepth}`)
  assert(validEvent?.articleId === "123", "Normalizer should keep articleId")

  const invalidEvent = normalizeContextEvent({
    articleId: 123, // Invalid type
    type: "invalid_type",
  })
  assert(invalidEvent === null, "Normalizer should reject invalid event types and missing article IDs")

  console.log(`\nQA Tests Complete: ${passed} passed, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

runTests().catch(console.error)

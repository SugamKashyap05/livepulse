/**
 * Test 1.2 — Verifies withRetry backs off correctly on 429s
 * Points AI_PROVIDER at mock NIM server in rate_limit mode.
 * Checks: timing between retries is exponential, not zero.
 *
 * Expected (PASS): 3 retries with ~1.5s, ~3s, ~6s gaps
 * Expected (FAIL): Retries fire immediately or not at all
 */
// @ts-expect-error - mock import for tests
import { withRetry } from "../../src/lib/ollama.ts";

let attemptCount = 0;
const attemptTimestamps: number[] = [];

async function fakeRateLimitedCall(): Promise<string> {
  attemptCount++;
  attemptTimestamps.push(Date.now());
  console.log(`[Attempt ${attemptCount}] at ${new Date().toISOString()}`);

  if (attemptCount < 3) {
    // Simulate NIM 429
    const err = new Error("Rate limit exceeded") as Error & { status?: number };
    err.status = 429;
    throw err;
  }
  return "success on attempt 3";
}

async function main() {
  console.log("\n[Test 1.2] Testing withRetry exponential backoff...");
  const start = Date.now();

  try {
    const result = await withRetry(fakeRateLimitedCall, 3, 1500);
    const totalMs = Date.now() - start;

    console.log(`\nResult: "${result}"`);
    console.log(`Total time: ${totalMs}ms`);

    // Verify gaps between attempts
    const gaps = attemptTimestamps.slice(1).map((t, i) => t - attemptTimestamps[i]);
    console.log("Gaps between retries (ms):", gaps);

    // Exponential: gap[0] ~1500ms, gap[1] ~3000ms
    const backoffWorking = gaps[0] >= 1400 && gaps[1] >= 2800;

    if (backoffWorking) {
      console.log("✅ PASS: Exponential backoff is working correctly.");
    } else {
      console.log("❌ FAIL: Backoff gaps are too short. Retry is hammering the API.");
    }
  } catch (err) {
    console.error("❌ FAIL: withRetry threw after exhausting retries:", err);
  }
}
main();

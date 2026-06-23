/**
 * Test 1.1 — Fires 50 rapid requests to /api/ai/summarize
 * WITHOUT going through isAiOverloaded() on the client side.
 * Simulates: malicious user, runaway loop, or misconfigured batch job
 * bypassing the app-level guard and hitting NIM directly.
 *
 * Expected (PASS): Server returns 503 or queues after ~38 requests
 * Expected (FAIL): All 50 requests go through → NIM 429 storm
 */
import fetch from "node-fetch";
// @ts-expect-error - mock import for tests
import { getMockAuthHeaders } from "./mock-auth.ts";

const BASE = "http://localhost:3000";
const TOTAL = 50;
const results = { ok: 0, rate_limited_app: 0, rate_limited_nim: 0, error: 0 };

async function fire(i: number) {
  try {
    const headers = await getMockAuthHeaders();
    const res = await fetch(`${BASE}/api/ai/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: `Test article number ${i} for rate limit testing.` }),
    });

    if (res.status === 200) results.ok++;
    else if (res.status === 503) results.rate_limited_app++;
    else if (res.status === 429) results.rate_limited_nim++;
    else results.error++;

    console.log(`[${i}] Status: ${res.status}`);
  } catch (err: unknown) {
    results.error++;
    console.error(`[${i}] Network error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Fire all 50 concurrently — worst case scenario
async function main() {
  console.log(`\n[Test 1.1] Firing ${TOTAL} concurrent requests...`);
  await Promise.all(Array.from({ length: TOTAL }, (_, i) => fire(i + 1)));

  console.log("\n[Test 1.1] Results:");
  console.log(results);

  // PASS condition: app-level guard caught the burst
  if (results.rate_limited_app > 0 && results.rate_limited_nim === 0) {
    console.log("✅ PASS: App-level guard intercepted burst. NIM never rate-limited.");
  } else if (results.rate_limited_nim > 0) {
    console.log("❌ FAIL: NIM rate-limited us directly. isAiOverloaded() is not effective.");
  } else {
    console.log("⚠️  AMBIGUOUS: Review results manually.");
  }
}
main();

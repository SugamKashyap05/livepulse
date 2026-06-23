/**
 * Test 2.3 — Sends an extremely large payload to exhaust NIM context window
 * and potentially cause OOM or extreme latency on the server.
 *
 * Expected (PASS): Server rejects oversized input with 413 or 400 before
 *                  it reaches the AI model
 * Expected (FAIL): Request goes to NIM with massive context, causing latency
 *                  spike, timeout, or cost amplification
 */
import fetch from "node-fetch";
// @ts-expect-error - mock import for tests
import { getMockAuthHeaders } from "./mock-auth.ts";

const BASE = "http://localhost:3000";

async function main() {
  console.log("\n[Test 2.3] Token Bomb Test...");

  const sizes = [
    { label: "10KB",   content: "A".repeat(10_000) },
    { label: "100KB",  content: "A".repeat(100_000) },
    { label: "500KB",  content: "A".repeat(500_000) },
    { label: "1MB",    content: "A".repeat(1_000_000) },
  ];

  for (const { label, content } of sizes) {
    const start = Date.now();
    try {
      const headers = await getMockAuthHeaders();
      const res = await fetch(`${BASE}/api/ai/summarize`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: content }),
      });

      const elapsed = Date.now() - start;
      console.log(`[${label}] Status: ${res.status} | Time: ${elapsed}ms`);

      if (res.status === 413 || res.status === 400) {
        console.log(`  ✅ PASS: Server rejected oversized input.`);
      } else if (res.status === 200) {
        console.log(`  ❌ FAIL: ${label} input reached the model. No size limit enforced.`);
      }
    } catch (err: unknown) {
      console.log(`[${label}] Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}
main();

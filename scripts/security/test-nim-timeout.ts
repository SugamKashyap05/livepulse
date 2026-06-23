/**
 * Test 1.3 — What happens when NIM never responds?
 * Points to mock NIM in "timeout" mode.
 * Verifies the app does not hang indefinitely.
 *
 * Expected (PASS): Request times out within 30s, returns 504 to client
 * Expected (FAIL): Server hangs forever, blocking the Node.js event loop
 */
import fetch from "node-fetch";
// @ts-expect-error - mock import for tests
import { getMockAuthHeaders } from "./mock-auth.ts";

const TIMEOUT_MS = 35_000; // give it 35s max

async function main() {
  console.log("\n[Test 1.3] Sending request with NIM in timeout mode...");
  console.log("(Expecting timeout/graceful failure within 30s)");

  const controller = new AbortController();
  const killswitch = setTimeout(() => {
    controller.abort();
    console.log("❌ FAIL: Request never timed out. Server may be hanging.");
  }, TIMEOUT_MS);

  const start = Date.now();
  try {
    const headers = await getMockAuthHeaders();
    const res = await fetch("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ messages: [{ role: "user", content: "Test timeout handling" }] }),
      signal: controller.signal as unknown as RequestInit["signal"],
    });

    clearTimeout(killswitch);
    const elapsed = Date.now() - start;
    console.log(`Response status: ${res.status} after ${elapsed}ms`);

    if (res.status === 504 || res.status === 503) {
      console.log("✅ PASS: Server returned timeout/unavailable response gracefully.");
    } else {
      console.log(`⚠️  UNEXPECTED: Got status ${res.status}. Review handler logic.`);
    }
  } catch (err: unknown) {
    clearTimeout(killswitch);
    const elapsed = Date.now() - start;
    if (err instanceof Error && err.name === "AbortError") {
      console.log(`❌ FAIL: Test aborted after ${elapsed}ms — server hung.`);
    } else {
      console.log(`⚠️  Error: ${err instanceof Error ? err.message : String(err)} after ${elapsed}ms`);
    }
  }
}
main();

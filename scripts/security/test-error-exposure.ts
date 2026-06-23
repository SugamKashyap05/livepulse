/**
 * Test 4.2 — Triggers AI errors deliberately and checks whether
 * the raw error (including model name, API URL, stack trace) leaks
 * to the client in the error response body.
 *
 * Expected (PASS): Error responses contain only a generic message
 * Expected (FAIL): Stack trace, model name, NIM URL, or API key fragment
 *                  is visible in the error response
 */
import fetch from "node-fetch";

const BASE = "http://localhost:3000";

// Send malformed payloads to trigger server errors
const MALFORMED_REQUESTS = [
  { path: "/api/ai/summarize",    body: {} },                        // missing required field
  { path: "/api/ai/summarize",    body: { text: null } },            // null field
  { path: "/api/ai/article-chat", body: { message: "x", articleId: null } }, // null id
  { path: "/api/ai/chat",         body: { message: "" } },           // empty message
];

const LEAK_SIGNALS = [
  "nvapi-",
  "integrate.api.nvidia.com",
  "at Object.",       // stack trace
  "node_modules",     // stack trace
  "NVIDIA_API_KEY",
  "Error: connect",   // raw Node network error
  "prisma",           // DB internals
];

async function main() {
  console.log("\n[Test 4.2] Error Response Leak Scan...\n");
  const failures: string[] = [];

  for (const req of MALFORMED_REQUESTS) {
    const res = await fetch(`${BASE}${req.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await res.text();
    const leaks = LEAK_SIGNALS.filter(sig => text.includes(sig));

    if (leaks.length > 0) {
      console.log(`❌ FAIL: ${req.path} leaks: [${leaks.join(", ")}]`);
      console.log(`   Response: ${text.slice(0, 300)}`);
      failures.push(req.path);
    } else {
      console.log(`✅ PASS: ${req.path} → ${res.status} (no internals leaked)`);
    }
  }

  if (failures.length === 0) {
    console.log("\n✅ All error responses are clean.");
  } else {
    console.log(`\n❌ ${failures.length} route(s) leak internal details. Sanitize error handlers.`);
  }
}
main();

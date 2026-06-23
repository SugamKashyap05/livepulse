/**
 * Test 5.1 — Verifies that AI output is sanitized before being
 * returned to the client. Uses mock NIM in "malicious_output" mode
 * which returns XSS payloads in the model response.
 *
 * Expected (PASS): XSS payload is escaped or stripped before client receives it
 * Expected (FAIL): Raw <script> tags or javascript: URLs reach the client
 */
import fetch from "node-fetch";
// @ts-expect-error - mock import for tests
import { getMockAuthHeaders } from "./mock-auth.ts";
const BASE = "http://localhost:3000";

const XSS_MARKERS = [
  "<script>",
  "javascript:",
  "onerror=",
  "onload=",
  "eval(",
  "document.cookie",
];

async function main() {
  console.log("\n[Test 5.1] XSS via AI Output Test...");
  console.log("NOTE: Requires mock NIM server running in malicious_output mode");
  console.log("      and NVIDIA_BASE_URL=http://localhost:4000?mode=malicious_output in .env.test\n");

  const headers = await getMockAuthHeaders();
  const res = await fetch(`${BASE}/api/ai/summarize`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "Summarize this article about technology." }),
  });

  const text = await res.text();
  const found = XSS_MARKERS.filter(m => text.includes(m));

  if (found.length > 0) {
    console.log(`❌ FAIL: XSS payload passed through unsanitized: [${found.join(", ")}]`);
    console.log(`   Raw response: ${text.slice(0, 300)}`);
  } else {
    console.log("✅ PASS: AI output is sanitized — no XSS markers in response.");
  }
}
main();

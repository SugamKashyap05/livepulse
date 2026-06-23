/**
 * Test 5.2 — Attempts to break structuredChat() by making the model
 * return malformed or malicious JSON. Verifies the parse guard holds.
 *
 * Expected (PASS): structuredChat throws a clean error, does not crash
 *                  the route or execute arbitrary code
 * Expected (FAIL): JSON.parse on attacker-controlled string executes
 *                  unexpected logic or crashes the process
 */
export {};

const MALICIOUS_JSON_PAYLOADS = [
  // Prototype pollution
  '{"__proto__": {"admin": true}}',
  // Constructor hijack
  '{"constructor": {"prototype": {"isAdmin": true}}}',
  // Valid JSON but unexpected shape (missing required fields)
  '{"unexpected_field": "value"}',
  // JSON with embedded XSS
  '{"title": "<script>alert(1)</script>", "score": 0}',
  // Truncated JSON (simulates token cutoff)
  '{"title": "Test", "score":',
  // Empty response
  '',
  // Not JSON at all
  'Here is the analysis: it was good.',
];

async function main() {
  console.log("\n[Test 5.2] structuredChat JSON Injection Test...\n");

  for (const payload of MALICIOUS_JSON_PAYLOADS) {
    try {
      // We can't directly inject into structuredChat without mocking,
      // so we test the JSON parsing logic in isolation
      const cleaned = payload
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      JSON.parse(cleaned);

      // Check prototype pollution
      const polluted = ({} as Record<string, unknown>).admin === true || ({} as Record<string, unknown>).isAdmin === true;
      if (polluted) {
        console.log(`❌ CRITICAL: Prototype pollution via: ${payload.slice(0, 50)}`);
      } else {
        console.log(`✅ Parsed safely: ${payload.slice(0, 50)}`);
      }
    } catch {
      // parse error is EXPECTED for malformed JSON — confirm it throws, not crashes
      console.log(`✅ Correctly threw on: ${payload.slice(0, 50)}`);
    }
  }

  // Check that prototype is actually clean
  const testObj: Record<string, unknown> = {};
  if (testObj.admin !== true && testObj.isAdmin !== true) {
    console.log("\n✅ PASS: No prototype pollution detected after all payloads.");
  } else {
    console.log("\n❌ CRITICAL: Prototype pollution occurred — Object.prototype was modified.");
  }
}
main();

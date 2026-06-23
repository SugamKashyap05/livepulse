/**
 * Test 3.1 — Attempts to hit every AI API route WITHOUT an auth token.
 *
 * Expected (PASS): All routes return 401 or 403
 * Expected (FAIL): Any route returns 200 (unauthenticated AI access)
 */
import fetch from "node-fetch";

const BASE = "http://localhost:3000";

// All AI routes from the audit
const AI_ROUTES = [
  { method: "POST", path: "/api/ai/chat",           body: { message: "test" } },
  { method: "POST", path: "/api/ai/article-chat",   body: { message: "test", articleId: "1" } },
  { method: "POST", path: "/api/ai/summarize",      body: { text: "test" } },
  { method: "POST", path: "/api/ai/sentiment",      body: { text: "test" } },
  { method: "POST", path: "/api/ai/tag",            body: { text: "test" } },
  { method: "GET", path: "/api/ai/digest",          },
  { method: "POST", path: "/api/ai/manager",        body: { action: "test" } },
  { method: "POST", path: "/api/ai/batch",          body: { articleIds: ["1"] } },
  { method: "POST", path: "/api/admin/rag/reindex", body: {} },
];

async function main() {
  console.log("\n[Test 3.1] Unauthenticated Access Scan...\n");
  const failures: string[] = [];

  for (const route of AI_ROUTES) {
    const res = await fetch(`${BASE}${route.path}`, {
      method: route.method,
      headers: { "Content-Type": "application/json" },
      // No Authorization header — simulating unauthenticated request
      body: JSON.stringify(route.body),
    });

    const icon = (res.status === 401 || res.status === 403) ? "✅" : "❌";
    console.log(`${icon} ${route.path} → ${res.status}`);

    if (res.status !== 401 && res.status !== 403) {
      failures.push(`${route.path} returned ${res.status} without auth`);
    }
  }

  console.log(`\n[Test 3.1] ${AI_ROUTES.length - failures.length}/${AI_ROUTES.length} routes properly protected`);
  if (failures.length > 0) {
    console.log("❌ UNPROTECTED ROUTES:");
    failures.forEach(f => console.log(`  - ${f}`));
  }
}
main();

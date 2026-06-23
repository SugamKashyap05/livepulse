/**
 * Test 3.2 — Attempts to access admin-only AI routes with a
 * regular user session token (not an admin token).
 *
 * Expected (PASS): Admin routes return 403 for non-admin users
 * Expected (FAIL): Regular user can trigger reindex or admin AI jobs
 *
 * SETUP: Set REGULAR_USER_TOKEN to a valid non-admin session token
 * from your dev environment before running.
 */
import fetch from "node-fetch";

const BASE = "http://localhost:3000";
const REGULAR_USER_TOKEN = process.env.TEST_USER_TOKEN ?? "REPLACE_WITH_REAL_TOKEN";

const ADMIN_ROUTES = [
  { method: "POST", path: "/api/admin/rag/reindex",    body: {} },
  { method: "GET",  path: "/api/admin/ai-jobs",        body: null },
  { method: "POST", path: "/api/admin/ai-jobs/cancel", body: { jobId: "1" } },
];

async function main() {
  console.log("\n[Test 3.2] Admin Privilege Escalation Scan...\n");

  if (REGULAR_USER_TOKEN === "REPLACE_WITH_REAL_TOKEN") {
    console.log("⚠️  SKIP: Set TEST_USER_TOKEN env var to a real non-admin token to run this test.");
    return;
  }

  for (const route of ADMIN_ROUTES) {
    const res = await fetch(`${BASE}${route.path}`, {
      method: route.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${REGULAR_USER_TOKEN}`,
      },
      body: route.body ? JSON.stringify(route.body) : undefined,
    });

    const icon = res.status === 403 ? "✅" : "❌";
    console.log(`${icon} ${route.path} → ${res.status} (expected 403)`);
  }
}
main();

// @ts-expect-error - mock import for tests
import { getMockAuthHeaders } from "./security/mock-auth.ts";

async function main() {
  console.log("Triggering RAG reindex on localhost:3000...");
  const headers = await getMockAuthHeaders();
  const res = await fetch("http://localhost:3000/api/admin/rag/reindex", {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "all" })
  });
  console.log("Status:", res.status);
  console.log("Response:", await res.text());
}
main();

/**
 * NVIDIA NIM Model Validation Script
 * Run: npx ts-node scripts/test-nvidia-models.ts
 *
 * Tests every model in the MODELS map with a minimal prompt.
 * Reports: reachable ✅ / rate-limited ⚠️ / failed ❌
 * Does NOT modify any LivePulse source files.
 */

import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const apiKey = process.env.NVIDIA_API_KEY;
const baseURL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

if (!apiKey) {
  console.error("❌ NVIDIA_API_KEY not found in .env — aborting.");
  process.exit(1);
}

const client = new OpenAI({ apiKey, baseURL });

// ── Model list to validate ──────────────────────────────────────────────────
const CHAT_MODELS: { label: string; model: string }[] = [
  { label: "fast (Scout / RAG chat)",         model: "meta/llama-3.1-8b-instruct" },
  { label: "smart (Fact-Checker / Digest)",   model: "meta/llama-3.3-70b-instruct" },
  { label: "reasoning (DeepSeek)",            model: "deepseek-ai/deepseek-v4-flash" },
  { label: "mini (Tag / Sentiment)",          model: "meta/llama-3.2-3b-instruct" },
  { label: "summarize (Mixtral)",             model: "mistralai/mixtral-8x7b-instruct-v0.1" },
];

const EMBED_MODELS: { label: string; model: string }[] = [
  { label: "embed (RAG ingestion + search)", model: "nvidia/nv-embedqa-e5-v5" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const TEST_PROMPT = "Reply with the single word: OK";
const TEST_EMBED_INPUT = "This is a test sentence for embedding validation.";
const DELAY_MS = 1800; // stay well under 40 RPM between calls

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function statusIcon(status: "ok" | "rate_limit" | "fail") {
  return { ok: "✅", rate_limit: "⚠️ ", fail: "❌" }[status];
}

// ── Chat model tester ────────────────────────────────────────────────────────
async function testChatModel(label: string, model: string) {
  process.stdout.write(`  Testing [${label}] → ${model} ... `);
  const start = Date.now();

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 10,
    });

    const reply = res.choices[0]?.message?.content?.trim() ?? "(empty)";
    const ms = Date.now() - start;
    console.log(`${statusIcon("ok")} "${reply}" (${ms}ms)`);
    return "ok";
  } catch (err: unknown) {
    const ms = Date.now() - start;
    if (err && typeof err === "object" && "status" in err && err.status === 429) {
      console.log(`${statusIcon("rate_limit")} Rate limited (${ms}ms) — model exists but quota hit`);
      return "rate_limit";
    }
    console.log(`${statusIcon("fail")} ${err instanceof Error ? err.message : "Unknown error"} (${ms}ms)`);
    return "fail";
  }
}

// ── Embed model tester ───────────────────────────────────────────────────────
async function testEmbedModel(label: string, model: string) {
  process.stdout.write(`  Testing [${label}] → ${model} ... `);
  const start = Date.now();

  try {
    const res = await client.embeddings.create({
      model,
      input: TEST_EMBED_INPUT,
      encoding_format: "float",
      // @ts-expect-error — NIM asymmetric model requires input_type
      input_type: "query",   // use "query" for the test — lighter weight
    });

    const dims = res.data[0]?.embedding?.length ?? 0;
    const ms = Date.now() - start;
    console.log(`${statusIcon("ok")} Vector dims: ${dims} (${ms}ms)`);
    return "ok";
  } catch (err: unknown) {
    const ms = Date.now() - start;
    if (err && typeof err === "object" && "status" in err && err.status === 429) {
      console.log(`${statusIcon("rate_limit")} Rate limited (${ms}ms)`);
      return "rate_limit";
    }
    console.log(`${statusIcon("fail")} ${err instanceof Error ? err.message : "Unknown error"} (${ms}ms)`);
    return "fail";
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔬 NVIDIA NIM — Model Validation Suite");
  console.log(`   Base URL : ${baseURL}`);
  console.log(`   API Key  : nvapi-****${apiKey!.slice(-4)}`);
  console.log("─".repeat(60));

  const results: { label: string; model: string; status: string }[] = [];

  // Test chat models
  console.log("\n📡 Chat Models:");
  for (const { label, model } of CHAT_MODELS) {
    const status = await testChatModel(label, model);
    results.push({ label, model, status });
    await sleep(DELAY_MS); // respect 40 RPM between each call
  }

  // Test embedding models
  console.log("\n🧬 Embedding Models:");
  for (const { label, model } of EMBED_MODELS) {
    const status = await testEmbedModel(label, model);
    results.push({ label, model, status });
    await sleep(DELAY_MS);
  }

  // Summary
  console.log("\n" + "─".repeat(60));
  console.log("📊 Summary:\n");

  let allPassed = true;
  for (const r of results) {
    const icon = statusIcon(r.status as "ok" | "rate_limit" | "fail");
    console.log(`  ${icon}  ${r.label}`);
    console.log(`      Model: ${r.model}`);
    if (r.status === "fail") allPassed = false;
  }

  console.log("\n" + "─".repeat(60));

  if (allPassed) {
    console.log("✅ All models reachable. Safe to proceed with LivePulse migration.\n");
  } else {
    console.log("❌ One or more models failed. Fix before proceeding with migration.");
    console.log("   Check: model string typo, API key validity, or NIM outage.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});

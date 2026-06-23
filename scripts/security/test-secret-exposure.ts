/**
 * Test 4.1 — Checks whether NVIDIA_API_KEY or other secrets are
 * accidentally bundled into the client-side Next.js JS output.
 *
 * Expected (PASS): No secrets found in .next/static/chunks/
 * Expected (FAIL): API key or internal URL found in browser-downloadable JS
 *
 * Run AFTER `npm run build`
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const NEXT_STATIC = path.join(process.cwd(), ".next", "static");
const SECRETS_TO_FIND = [
  process.env.NVIDIA_API_KEY ?? "nvapi-",
  "integrate.api.nvidia.com",
  "NVIDIA_API_KEY",
  process.env.DATABASE_URL?.slice(0, 20) ?? "postgresql://",
  process.env.NEXTAUTH_SECRET?.slice(0, 10) ?? "NEXTAUTH_SECRET",
];

function findFiles(dir: string, pattern: RegExp): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(file, pattern));
    } else {
      if (pattern.test(file)) results.push(file);
    }
  });
  return results;
}

function searchDir(dir: string, secrets: string[]): { file: string; secret: string; line: number }[] {
  const findings: { file: string; secret: string; line: number }[] = [];

  if (!fs.existsSync(dir)) {
    console.log(`⚠️  ${dir} not found. Run 'npm run build' first.`);
    return findings;
  }

  const files = findFiles(dir, /\.js$/);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (const secret of secrets) {
      if (!secret || secret.length < 5) continue;
      lines.forEach((line, i) => {
        if (line.includes(secret)) {
          findings.push({ file: path.relative(process.cwd(), file), secret, line: i + 1 });
        }
      });
    }
  }
  return findings;
}

async function main() {
  console.log("\n[Test 4.1] Client Bundle Secret Scan...");
  const findings = searchDir(NEXT_STATIC, SECRETS_TO_FIND);

  if (findings.length === 0) {
    console.log("✅ PASS: No secrets found in client bundle.");
  } else {
    console.log(`\n❌ CRITICAL: ${findings.length} secret exposure(s) found in client bundle:`);
    findings.forEach(f => {
      console.log(`  File: ${f.file} | Line: ${f.line} | Secret: ${f.secret.slice(0, 15)}...`);
    });
    console.log("\nFix: Ensure these are ONLY used in server-side files.");
    console.log("Never prefix NVIDIA_API_KEY with NEXT_PUBLIC_.");
  }
}
main();

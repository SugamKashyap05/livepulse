import { execSync } from "child_process";

const tests = [
  "scripts/security/test-rate-limit.ts",
  "scripts/security/test-retry-backoff.ts",
  "scripts/security/test-nim-timeout.ts",
  "scripts/security/test-prompt-injection.ts",
  "scripts/security/test-rag-injection.ts",
  "scripts/security/test-token-bomb.ts",
  "scripts/security/test-auth-bypass.ts",
  "scripts/security/test-admin-escalation.ts",
  "scripts/security/test-secret-exposure.ts",
  "scripts/security/test-error-exposure.ts",
  "scripts/security/test-xss-output.ts",
  "scripts/security/test-json-injection.ts",
];

for (const test of tests) {
  try {
    execSync(`npx ts-node ${test}`, { stdio: "inherit" });
  } catch {
    console.error(`Error running ${test}`);
  }
}

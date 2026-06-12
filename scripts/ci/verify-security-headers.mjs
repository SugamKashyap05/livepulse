import { readFileSync } from "node:fs"
import { join } from "node:path"

const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8")

const requiredHeaders = [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]

const requiredCspDirectives = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]

const failures = []

for (const header of requiredHeaders) {
  if (!config.includes(header)) {
    failures.push(`Missing security header: ${header}`)
  }
}

for (const directive of requiredCspDirectives) {
  if (!config.includes(directive)) {
    failures.push(`Missing CSP directive: ${directive}`)
  }
}

if (!config.includes("poweredByHeader: false")) {
  failures.push("Next poweredByHeader is not disabled")
}

if (!config.includes('source: "/:path*"')) {
  failures.push("Security headers are not applied to all routes")
}

if (failures.length > 0) {
  console.error("Security header check failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Security header check passed.")

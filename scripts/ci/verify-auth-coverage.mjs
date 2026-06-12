import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = process.cwd()
const proxyPath = join(root, "src", "proxy.ts")
const proxy = readFileSync(proxyPath, "utf8")

const requiredMatchers = [
  '"/admin/:path*"',
  '"/api/admin/:path*"',
  '"/profile/:path*"',
  '"/onboarding/:path*"',
  '"/bookmarks/:path*"',
  '"/settings/:path*"',
]

const failures = []

for (const matcher of requiredMatchers) {
  if (!proxy.includes(matcher)) {
    failures.push(`src/proxy.ts is missing matcher ${matcher}`)
  }
}

for (const snippet of [
  "isAdminAuthorized(request)",
  "NextResponse.json({ error: \"Unauthorized\" }, { status: 401 })",
  "auth.middleware({ loginUrl: \"/login\" })(request)",
  "isNeonAuthConfigured()",
]) {
  if (!proxy.includes(snippet)) {
    failures.push(`src/proxy.ts is missing auth guard snippet: ${snippet}`)
  }
}

const adminRoutesDir = join(root, "src", "app", "api", "admin")
const routeFiles = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      walk(path)
    } else if (entry === "route.ts") {
      routeFiles.push(path)
    }
  }
}

walk(adminRoutesDir)

const allowedProxyOnlyRoutes = new Set([
  join(adminRoutesDir, "auth", "route.ts"),
  join(adminRoutesDir, "logout", "route.ts"),
])

for (const file of routeFiles) {
  if (allowedProxyOnlyRoutes.has(file)) continue

  const source = readFileSync(file, "utf8")
  if (!source.includes("isAdminAuthorized") && !source.includes("CRON_SECRET")) {
    failures.push(
      `${relative(root, file)} does not include an explicit admin or cron authorization check`,
    )
  }
}

if (routeFiles.length === 0) {
  failures.push("No admin route handlers were found under src/app/api/admin")
}

if (failures.length > 0) {
  console.error("Auth coverage check failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Auth coverage check passed for ${routeFiles.length} admin route handlers.`)

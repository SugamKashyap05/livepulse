const baseUrl = process.env.LIVEPULSE_SMOKE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL

if (!baseUrl) {
  console.error("Set LIVEPULSE_SMOKE_BASE_URL or NEXT_PUBLIC_BASE_URL before running smoke checks.")
  process.exit(1)
}

const normalizedBaseUrl = baseUrl.replace(/\/$/, "")

async function check(path, validate) {
  const response = await fetch(`${normalizedBaseUrl}${path}`, {
    redirect: "manual",
    headers: { "User-Agent": "LivePulse-CI-Smoke/1.0" },
  })

  const result = await validate(response)
  if (!result.ok) {
    throw new Error(`${path} failed: ${result.message}`)
  }

  console.log(`${path} passed (${response.status})`)
}

await check("/", async (response) => ({
  ok: response.status >= 200 && response.status < 400,
  message: `expected public site to return 2xx/3xx, got ${response.status}`,
}))

await check("/admin", async (response) => ({
  ok: [302, 303, 307, 308].includes(response.status),
  message: `expected admin page to redirect unauthenticated users, got ${response.status}`,
}))

await check("/api/admin/ping", async (response) => ({
  ok: response.status === 401,
  message: `expected admin API to reject unauthenticated requests, got ${response.status}`,
}))

await check("/api/sync", async (response) => ({
  ok: [401, 405].includes(response.status),
  message: `expected sync endpoint to reject unauthenticated smoke request, got ${response.status}`,
}))

console.log(`Smoke checks passed for ${normalizedBaseUrl}.`)

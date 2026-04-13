const SYNC_INTERVAL_MS = 5 * 60 * 1000
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

let isSyncing = false
let syncCount = 0

async function runSync() {
  if (isSyncing) {
    console.log("[LivePulse AutoSync] Skipping — previous sync still running")
    return
  }

  isSyncing = true
  syncCount++

  try {
    console.log(`[LivePulse AutoSync] Starting sync #${syncCount}...`)
    const res = await fetch(`${BASE_URL}/api/sync`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
    })

    const data = await res.json()
    console.log(
      `[LivePulse AutoSync] Sync #${syncCount} done —`,
      `saved: ${data.saved ?? 0},`,
      `skipped: ${data.skipped ?? 0},`,
      `total: ${data.total ?? 0}`
    )
  } catch (error) {
    console.error(`[LivePulse AutoSync] Sync #${syncCount} failed:`, error)
  } finally {
    isSyncing = false
  }
}

export function startAutoSync() {
  console.log("[LivePulse AutoSync] Starting — first sync in 3 seconds...")

  setTimeout(() => {
    runSync()
    setInterval(runSync, SYNC_INTERVAL_MS)
  }, 3000)
}

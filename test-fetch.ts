import { fetchAllFeeds, fetchFeedsWithStatus } from "./src/lib/fetchFeeds"
import { FEED_SOURCES } from "./src/lib/sources"

async function run() {
  console.log("Testing fetch...")
  const res = await fetchFeedsWithStatus(FEED_SOURCES.slice(0, 3))
  console.log("Success:", res.successNames)
  console.log("Failed:", res.failedSources)
}

run().catch(console.error)

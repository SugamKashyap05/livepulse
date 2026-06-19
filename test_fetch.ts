import { fetchFeedsWithStatus } from "./src/lib/fetchFeeds"
import { FEED_SOURCES } from "./src/lib/sources"

async function run() {
  console.log("Testing fetch engine...")
  const result = await fetchFeedsWithStatus(FEED_SOURCES.slice(0, 5)) // Test first 5 sources
  console.log("Success count:", result.successNames.length)
  console.log("Failed count:", result.failedNames.length)
  console.log("Failed sources details:", result.failedSources)
  console.log("Articles fetched:", result.articles.length)
}

run().catch(console.error)

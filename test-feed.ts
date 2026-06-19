import { getPaginatedFeed } from "./src/lib/paginatedFeed"
import { prisma } from "./src/lib/db"

async function run() {
  console.log("Testing feed generation...")
  const res = await getPaginatedFeed({ limit: 10 })
  console.log("Feed returned:", res.articles.length, "articles")
  if (res.articles.length > 0) {
    console.log("First article:", res.articles[0].title)
  }
}

run().catch(console.error).finally(() => prisma.$disconnect())

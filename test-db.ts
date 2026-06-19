import { prisma } from "./src/lib/db"

async function run() {
  const articlesCount = await prisma.newsArticle.count()
  const sourcesCount = await prisma.feedSource.count()
  console.log("Articles in DB:", articlesCount)
  console.log("Sources in DB:", sourcesCount)
}

run().catch(console.error).finally(() => prisma.$disconnect())

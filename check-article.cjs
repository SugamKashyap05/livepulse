const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  // Search for articles matching the screenshot title
  const articles = await prisma.newsArticle.findMany({
    where: {
      OR: [
        { title: { contains: "outperformed Tuchel" } },
        { title: { contains: "De la Fuente" } },
      ]
    },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      aiProcessed: true,
    },
    take: 10
  })

  console.log(`Found ${articles.length} article(s):\n`)
  for (const a of articles) {
    console.log(`ID: ${a.id}`)
    console.log(`Title: ${a.title}`)
    console.log(`Summary: ${a.summary === null ? "<<NULL>>" : a.summary === "" ? "<<EMPTY>>" : a.summary.slice(0, 200)}`)
    console.log(`Description: ${a.description === null ? "<<NULL>>" : a.description === "" ? "<<EMPTY>>" : a.description.slice(0, 200)}`)
    console.log(`AI Processed: ${a.aiProcessed}`)
    console.log("---")
  }

  // Count how many articles have null summaries
  const totalArticles = await prisma.newsArticle.count()
  const nullSummaries = await prisma.newsArticle.count({ where: { summary: null } })
  const emptySummaries = await prisma.newsArticle.count({ where: { summary: "" } })
  console.log(`\n=== SUMMARY FIELD STATISTICS ===`)
  console.log(`Total articles: ${totalArticles}`)
  console.log(`NULL summaries: ${nullSummaries} (${((nullSummaries/totalArticles)*100).toFixed(1)}%)`)
  console.log(`Empty summaries: ${emptySummaries} (${((emptySummaries/totalArticles)*100).toFixed(1)}%)`)
  console.log(`Has summary: ${totalArticles - nullSummaries - emptySummaries}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

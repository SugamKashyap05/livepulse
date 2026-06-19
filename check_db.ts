import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function check() {
    const articleCount = await prisma.newsArticle.count()
    const sourceCount = await prisma.feedSource.count()
    const sourceOk = await prisma.feedSource.count({ where: { lastStatus: "ok" } })
    const sourceError = await prisma.feedSource.count({ where: { lastStatus: "error" } })
    
    console.log("Articles:", articleCount)
    console.log("Sources Total:", sourceCount)
    console.log("Sources OK:", sourceOk)
    console.log("Sources Error:", sourceError)
}

check().catch(console.error).finally(() => prisma.$disconnect())

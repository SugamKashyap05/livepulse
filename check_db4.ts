import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function check() {
    const countPublished = await prisma.newsArticle.count({ where: { published: true } });
    const countDraft = await prisma.newsArticle.count({ where: { published: false } });
    console.log("Published:", countPublished);
    console.log("Draft:", countDraft);
}

check().catch(console.error).finally(() => prisma.$disconnect())

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function check() {
    const newest = await prisma.newsArticle.findFirst({
        orderBy: { fetchedAt: 'desc' }
    });
    console.log("Newest article fetched at:", newest?.fetchedAt);
}

check().catch(console.error).finally(() => prisma.$disconnect())

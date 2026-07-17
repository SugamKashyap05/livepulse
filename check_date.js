const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const article = await prisma.newsArticle.findFirst({select: {publishedAt: true}});
  console.log(article);
}
main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const article = await prisma.newsArticle.findFirst({});
  console.log(Object.keys(article));
}
main().finally(() => prisma.$disconnect());

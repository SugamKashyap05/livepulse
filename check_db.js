// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const articlesCount = await prisma.newsArticle.count();
  const visibleArticlesCount = await prisma.newsArticle.count({where: {visible: true}});
  const publishedArticlesCount = await prisma.newsArticle.count({where: {published: true}});
  
  const embeddingsCount = await prisma.$queryRaw`SELECT count(*) FROM "ArticleEmbedding"`;
  console.log("Articles:", articlesCount);
  console.log("Visible Articles:", visibleArticlesCount);
  console.log("Published Articles:", publishedArticlesCount);
  console.log("Embeddings:", embeddingsCount);
}
main().finally(() => prisma.$disconnect());

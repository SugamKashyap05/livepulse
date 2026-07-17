const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const embedding = await prisma.articleEmbedding.findFirst({select: {embeddingModel: true}});
  console.log(embedding);
}
main().finally(() => prisma.$disconnect());

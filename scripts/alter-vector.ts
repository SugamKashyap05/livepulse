import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Altering vector column to 1024 dimensions...");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ArticleEmbedding" CASCADE;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ArticleEmbedding" ALTER COLUMN "embedding" TYPE vector(1024);`);
  console.log("Done");
  process.exit(0);
}
main();

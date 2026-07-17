const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.ragQueryCache.deleteMany({});
  console.log("Cache cleared.");
  await p.$disconnect();
}
main().catch(console.error);

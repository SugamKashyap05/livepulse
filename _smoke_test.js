const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const c = await p.articleChunk.count({
    where: { articleId: 'f58c3e726694b3315c2caf215d392d38' }
  });
  console.log('Chunks:', c);
  await p.$disconnect();
}
main().catch(console.error);

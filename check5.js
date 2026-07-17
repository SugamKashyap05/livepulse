// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.aiLog.findMany({ 
  where: { action: { contains: 'EVAL' } },
  orderBy: { createdAt: 'desc' },
  take: 5
}).then(logs => console.log(logs)).finally(() => prisma.$disconnect());

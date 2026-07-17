const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.ragQueryCache.deleteMany({}).then(() => console.log('Cache cleared')).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.newsArticle.findFirst().then(a => console.log(a.id)).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.userProfile.findFirst().then(u => console.log(u ? u.id : 'no_user')).finally(() => prisma.$disconnect());

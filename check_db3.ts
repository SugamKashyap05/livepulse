import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function check() {
    const disabled = await prisma.feedSource.findMany({
        where: { enabled: false }
    });
    console.log("Disabled sources:", disabled.map(d => `${d.name} - ${d.lastErrorMessage}`));
}

check().catch(console.error).finally(() => prisma.$disconnect())

import { prisma } from '@/lib/db';

export async function purgeExpiredRagCacheEntries() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.ragQueryCache.deleteMany({
    where: { expiresAt: { lt: yesterday } },
  });

  return result.count;
}

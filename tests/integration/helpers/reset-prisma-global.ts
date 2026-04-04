import type { PrismaClient } from '@prisma/client';

/** Clears Next app singleton so a new `PrismaClient` picks up `process.env.DATABASE_URL`. */
export async function resetPrismaGlobalSingleton(): Promise<void> {
  const g = globalThis as typeof globalThis & { prisma?: PrismaClient };
  if (g.prisma) {
    await g.prisma.$disconnect().catch(() => {});
    delete g.prisma;
  }
}

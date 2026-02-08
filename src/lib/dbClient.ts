import { PrismaClient } from '@prisma/client';
import { initSlackLogger } from './logger';

initSlackLogger();

declare const global: Global & { prisma?: PrismaClient };

if (global.prisma == null) {
  global.prisma = new PrismaClient();
}

export default global.prisma!;

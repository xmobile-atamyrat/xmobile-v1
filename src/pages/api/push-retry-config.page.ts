import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { requireSuperuserBearerAuth } from '@/pages/api/utils/staffAuth';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const filepath = 'src/pages/api/push-retry-config.page.ts';

const DEFAULTS = {
  enabled: true,
  maxRetries: 3,
  baseDelaySec: 30,
  backoffMultiplier: 2.0,
  maxDelaySec: 3600,
};

const ConfigSchema = z
  .object({
    enabled: z.boolean(),
    maxRetries: z.number().int().min(0).max(10),
    baseDelaySec: z.number().int().min(1),
    backoffMultiplier: z.number().min(1),
    maxDelaySec: z.number().int().min(1),
  })
  .refine((c) => c.maxDelaySec >= c.baseDelaySec, {
    message: 'maxDelaySec must be >= baseDelaySec',
    path: ['maxDelaySec'],
  });

async function getConfig() {
  return dbClient.pushRetryConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULTS },
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  addCors(res);

  if (req.method === 'GET') {
    try {
      return res.status(200).json(await getConfig());
    } catch (error) {
      console.error(`${filepath} GET:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    if (!(await requireSuperuserBearerAuth(req, res))) return undefined;

    let data: z.infer<typeof ConfigSchema>;
    try {
      data = ConfigSchema.parse(req.body);
    } catch (error: any) {
      return res.status(400).json({
        message: `Validation error: ${error?.errors?.[0]?.message ?? 'invalid body'}`,
      });
    }

    try {
      const config = await dbClient.pushRetryConfig.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data },
      });
      return res.status(200).json({ success: true, data: config });
    } catch (error) {
      console.error(`${filepath} PUT:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

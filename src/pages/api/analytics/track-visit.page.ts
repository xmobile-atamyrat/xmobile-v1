import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/analytics/track-visit.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  try {
    // Extract IP address from request headers
    let ip =
      req.headers['x-real-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress;

    if (Array.isArray(ip)) {
      ip = ip[0];
    }

    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Could not determine IP address',
      });
    }

    // Track visit in database
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00.000

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // Set to 23:59:59.999

    const visitedToday = await dbClient.userVisitRecord.findFirst({
      where: {
        ip,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    if (!visitedToday) {
      await dbClient.userVisitRecord.create({
        data: {
          ip,
        },
      });
    } else {
      await dbClient.userVisitRecord.update({
        where: {
          id: visitedToday.id,
        },
        data: {
          dailyVisitCount: visitedToday.dailyVisitCount + 1,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Visit tracked successfully',
    });
  } catch (error) {
    console.error(`${filepath}: Error tracking visit:`, error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to track visit',
    });
  }
}

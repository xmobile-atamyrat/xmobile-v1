import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/analytics/stats.page.ts';

interface AnalyticsStats {
  userCount: number;
  dailyVisitCount: number;
  lastWeekVisitCount: number;
  lastMonthVisitCount: number;
  balance: number | null;
  errorMessage: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<AnalyticsStats>>,
) {
  addCors(res);

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  let userCount = 0;
  let dailyVisitCount = 0;
  let lastWeekVisitCount = 0;
  let lastMonthVisitCount = 0;
  let errorMessage: string | null = null;
  let balance: number | null = null;

  const telekomUsername = process.env.TELEKOM_USERNAME;
  const telekomPassword = process.env.TELEKOM_PASSWORD;

  try {
    userCount = await dbClient.user.count();
  } catch (error) {
    console.error(`${filepath}: Error fetching user count:`, error);
    errorMessage = (error as Error).message;
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00.000

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    dailyVisitCount = await dbClient.userVisitRecord.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });
  } catch (error) {
    console.error(`${filepath}: Error fetching daily visit count:`, error);
    errorMessage = (error as Error).message;
  }

  try {
    const now = new Date();
    const startOfWeekAgo = new Date(now);
    startOfWeekAgo.setDate(now.getDate() - 7);

    lastWeekVisitCount = await dbClient.userVisitRecord.count({
      where: {
        createdAt: {
          gte: startOfWeekAgo,
          lte: now,
        },
      },
    });
  } catch (error) {
    console.error(`${filepath}: Error fetching last week visit count:`, error);
    errorMessage = (error as Error).message;
  }

  try {
    const now = new Date();
    const startOfMonthAgo = new Date(now);
    startOfMonthAgo.setMonth(now.getMonth() - 1);

    lastMonthVisitCount = await dbClient.userVisitRecord.count({
      where: {
        createdAt: {
          gte: startOfMonthAgo,
          lte: now,
        },
      },
    });
  } catch (error) {
    console.error(`${filepath}: Error fetching last month visit count:`, error);
    errorMessage = (error as Error).message;
  }

  // Fetch Telekom balance if credentials are available
  if (telekomUsername != null && telekomPassword != null) {
    try {
      const loginResponse = await fetch(
        'https://os.telecom.tm:5000/api/v1/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: telekomUsername,
            password: telekomPassword,
          }),
        },
      );

      if (!loginResponse.ok) {
        throw new Error('Login request failed');
      }

      const loginData = await loginResponse.json();
      const accessToken = loginData.result.accessToken;
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };
      const clientResponse = await fetch(
        'https://os.telecom.tm:5000/api/v1/clients/self',
        { headers },
      );
      if (!clientResponse.ok) {
        throw new Error('Client data request failed');
      }
      const clientData = await clientResponse.json();
      balance = Math.floor(clientData.result.client.balance);
    } catch (error) {
      console.error(`${filepath}: Error fetching Telekom balance:`, error);
      errorMessage = (error as Error).message;
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      userCount,
      dailyVisitCount,
      lastWeekVisitCount,
      lastMonthVisitCount,
      balance,
      errorMessage,
    },
  });
}

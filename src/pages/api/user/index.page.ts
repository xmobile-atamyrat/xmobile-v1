import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { generateTokens, REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import {
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/user/signin.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<{ accessToken: string; user: User }>>,
) {
  addCors(res);
  const { method } = req;
  const refreshToken = req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    console.error(`${filepath}: No refresh token found`);
    return res
      .status(401)
      .json({ success: false, message: 'Unauthorized: Missing refresh token' });
  }

  if (method === 'GET') {
    try {
      const { userId } = await verifyToken(refreshToken, REFRESH_SECRET);

      const user = await dbClient.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        console.error(`${filepath}: User not found`);
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized: User not found' });
      }
      delete user.password;

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(
        user.id,
        user.grade,
      );

      res.setHeader(
        'Set-Cookie',
        `${AUTH_REFRESH_COOKIE_NAME}=${newRefreshToken}; Secure; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
      );

      return res.status(200).json({
        success: true,
        data: { user, accessToken },
      });
    } catch (error) {
      console.error(error);
      if ((error as Error).name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Refresh token expired',
        });
      }
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

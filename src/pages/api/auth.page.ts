import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import {
  generateTokens,
  verifyRefreshToken,
} from '@/pages/api/utils/tokenUtils';
import {
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/auth.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<{ accessToken: string; user: User }>>,
) {
  addCors(res);
  const { method } = req;
  const cookies = req.headers.cookie;

  if (method === 'GET') {
    try {
      const refreshToken = cookies
        .split('; ')
        .find((row) => row.startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`))
        ?.split('=')[1];

      const userId = verifyRefreshToken(refreshToken);

      const user = await dbClient.user.findUnique({
        where: { id: userId },
      });
      delete user.password;

      const { accessToken, refreshToken: newRefreshToken } =
        generateTokens(userId);

      res.setHeader(
        'Set-Cookie',
        `${AUTH_REFRESH_COOKIE_NAME}=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
      );

      return res
        .status(200)
        .json({ success: true, data: { accessToken, user } });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        console.error(filepath, ' Invalid Refresh Token; ', error);
        return res
          .status(401)
          .json({ success: false, message: 'Refresh token expired' });
      }
      console.error(filepath, "Couldn't authenticate user. ", error);
      return res
        .status(500)
        .json({ success: false, message: "Couldn't authenticate user" });
    }
  } else if (method === 'PUT') {
    res.setHeader(
      'Set-Cookie',
      `${AUTH_REFRESH_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=${0}; Path=/`,
    );

    return res
      .status(200)
      .json({ success: true, message: 'UserSession Closed' });
  } else {
    return res
      .status(405)
      .json({ success: false, message: 'Method Not Allowed' });
  }
}

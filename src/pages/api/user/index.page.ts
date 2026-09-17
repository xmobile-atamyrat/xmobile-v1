import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { secureCookieAttr } from '@/pages/api/utils/requestScheme';
import {
  ACCESS_SECRET,
  generateTokens,
  REFRESH_SECRET,
} from '@/pages/api/utils/tokenUtils';
import {
  authRefreshCookieName,
  authRefreshCookieNames,
  readAuthRefreshCookie,
} from '@/pages/lib/cookieNames';
import { REFRESH_TOKEN_EXPIRY_COOKIE } from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/user/signin.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<{ accessToken: string; user: User }>>,
) {
  if (addCors(req, res)) return undefined;
  const { method } = req;

  if (method === 'GET') {
    try {
      const refreshToken = readAuthRefreshCookie(req.cookies, req);
      if (!refreshToken) {
        console.error(`${filepath}: No refresh token found`);
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Missing refresh token',
        });
      }

      const { userId } = await verifyToken(refreshToken, REFRESH_SECRET);

      const user = await dbClient.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        console.warn(`${filepath}: User not found`);
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized: User not found' });
      }

      if (user.deletedAt != null) {
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
        `${authRefreshCookieName(req)}=${newRefreshToken}; ${secureCookieAttr(req)}SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
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

  if (method === 'DELETE') {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }
      const token = authHeader.split(' ')[1];
      const { userId } = await verifyToken(token, ACCESS_SECRET);

      const user = await dbClient.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'userNotFound' });
      }
      if (user.deletedAt != null) {
        return res
          .status(404)
          .json({ success: false, message: 'accountAlreadyDeleted' });
      }

      await dbClient.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      res.setHeader(
        'Set-Cookie',
        // Clear every name the token may be stored under -- on a namespaced
        // host a leftover copy under the shared name would still authenticate.
        authRefreshCookieNames(req).map(
          (name) =>
            `${name}=; ${secureCookieAttr(req)}SameSite=Strict; Max-Age=0; Path=/`,
        ),
      );

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      const name = (error as Error).name;
      if (
        name === 'TokenExpiredError' ||
        name === 'JsonWebTokenError' ||
        name === 'NotBeforeError'
      ) {
        return res
          .status(401)
          .json({ success: false, message: 'Unauthorized' });
      }
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

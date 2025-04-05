import { ACCESS_SECRET, generateTokens } from '@/pages/api/utils/tokenUtils';
import {
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import jwt from 'jsonwebtoken';
import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

export const verifyToken = (token: string, secret: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded as string);
    });
  });
};

interface AuthenticatedRequest extends NextApiRequest {
  userId?: string;
}

const withAuth = (
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => Promise<void> | void,
): NextApiHandler => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    const refreshToken = req.cookies[AUTH_REFRESH_COOKIE_NAME];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ message: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const userId = await verifyToken(token, ACCESS_SECRET);
      (req as AuthenticatedRequest).userId = userId;
      return handler(req as AuthenticatedRequest, res);
    } catch (accessTokenError) {
      if (accessTokenError.name === 'TokenExpiredError') {
        try {
          const userId = await verifyToken(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
          );
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            generateTokens(userId);

          req.headers.authorization = `Bearer ${newAccessToken}`;
          (req as AuthenticatedRequest).userId = userId;

          res.setHeader(
            'Set-Cookie',
            `${AUTH_REFRESH_COOKIE_NAME}=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
          );
          res.setHeader('Authorization', `Bearer ${newAccessToken}`);
          const originalResponse = await handler(
            req as AuthenticatedRequest,
            res,
          );
          return originalResponse;
        } catch (refreshTokenError) {
          return res.status(401).json({
            message: 'Unauthorized: Refresh token expired',
          });
        }
      }
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  };
};

export default withAuth;

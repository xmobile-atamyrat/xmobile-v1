import { ACCESS_SECRET, generateTokens } from '@/pages/api/utils/tokenUtils';
import {
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import { UserRole } from '@prisma/client';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

export const verifyToken = (
  token: string,
  secret: string,
): Promise<JwtPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded as JwtPayload);
    });
  });
};

export interface AuthenticatedRequest extends NextApiRequest {
  userId?: string;
  grade?: UserRole;
}

const BYPASS_AUTH_PATHS = ['/api/prices/rate', '/api/prices'];
const BYPASS_AUTH_METHODS = ['GET'];

const withAuth = (
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => Promise<void> | void,
): NextApiHandler => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (
      BYPASS_AUTH_PATHS.includes(req.url as string) &&
      BYPASS_AUTH_METHODS.includes(req.method)
    ) {
      return handler(req, res);
    }

    const authHeader = req.headers.authorization;
    const refreshToken = req.cookies[AUTH_REFRESH_COOKIE_NAME];

    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !refreshToken) {
      return res
        .status(401)
        .json({ message: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const { userId, grade } = await verifyToken(token, ACCESS_SECRET);
      (req as AuthenticatedRequest).userId = userId;
      (req as AuthenticatedRequest).grade = grade;
      return handler(req as AuthenticatedRequest, res);
    } catch (accessTokenError) {
      if (accessTokenError.name === 'TokenExpiredError') {
        try {
          const { userId, grade } = await verifyToken(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
          );
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            generateTokens(userId, grade);

          req.headers.authorization = `Bearer ${newAccessToken}`;
          (req as AuthenticatedRequest).userId = userId;
          (req as AuthenticatedRequest).grade = grade;

          res.setHeader(
            'Set-Cookie',
            `${AUTH_REFRESH_COOKIE_NAME}=${newRefreshToken}; Secure; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
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

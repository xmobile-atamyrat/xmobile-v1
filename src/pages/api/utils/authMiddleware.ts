import { secureCookieAttr } from '@/pages/api/utils/requestScheme';
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

/**
 * Mints a fresh token pair from the refresh cookie, for a request whose access
 * token has expired. The rotated cookie and an `Authorization` response header
 * (which `fetchWithCreds` stores) are set on `res`, and the request's own header
 * is rewritten so anything later in the request sees the new token. Rejects
 * when the cookie is missing or invalid.
 */
export async function refreshFromCookie(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ userId: string; grade: UserRole }> {
  const refreshToken = req.cookies?.[AUTH_REFRESH_COOKIE_NAME];
  const { userId, grade } = await verifyToken(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
  );
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    generateTokens(userId, grade);

  req.headers.authorization = `Bearer ${newAccessToken}`;
  res.setHeader(
    'Set-Cookie',
    `${AUTH_REFRESH_COOKIE_NAME}=${newRefreshToken}; ${secureCookieAttr(req)}SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
  );
  res.setHeader('Authorization', `Bearer ${newAccessToken}`);
  return { userId, grade };
}

export interface AuthenticatedRequest extends NextApiRequest {
  userId?: string;
  grade?: UserRole;
}

const BYPASS_AUTH_PATHS = [
  '/api/prices/rate',
  '/api/prices',
  '/api/brand',
  '/api/colors',
];
const BYPASS_AUTH_METHODS = ['GET'];

const withAuth = (
  handler: (
    req: AuthenticatedRequest,
    res: NextApiResponse,
  ) => Promise<void> | void,
): NextApiHandler => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (
      BYPASS_AUTH_PATHS.includes(req.url?.split('?')[0]) &&
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

    const token = authHeader?.split(' ')[1];

    try {
      if (!token) {
        const error = new Error('Missing access token');
        error.name = 'TokenExpiredError';
        throw error;
      }
      const { userId, grade } = await verifyToken(token, ACCESS_SECRET);
      (req as AuthenticatedRequest).userId = userId;
      (req as AuthenticatedRequest).grade = grade;
      return handler(req as AuthenticatedRequest, res);
    } catch (accessTokenError) {
      if (accessTokenError.name === 'TokenExpiredError') {
        try {
          const { userId, grade } = await refreshFromCookie(req, res);
          (req as AuthenticatedRequest).userId = userId;
          (req as AuthenticatedRequest).grade = grade;

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

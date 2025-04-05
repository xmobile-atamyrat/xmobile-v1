import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@/pages/lib/constants';
import jwt, { JwtPayload } from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ id: userId }, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken };
};

/**
 * Verifies a refresh token and returns the userId.
 * @param token - the refresh token to verify
 * @returns the userId if the token is valid, otherwise throws an exception
 */
export const verifyRefreshToken = (token: string) => {
  return (jwt.verify(token, REFRESH_SECRET) as JwtPayload).id;
};

/**
 * Verifies an access token and returns the userId.
 * @param token - the refresh token to verify
 * @returns the userId if the token is valid, otherwise throws an exception
 */
export const verifyAccessToken = (token: string) => {
  return (jwt.verify(token, ACCESS_SECRET) as JwtPayload).id;
};

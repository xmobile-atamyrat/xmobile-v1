import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_COOKIE,
  REFRESH_TOKEN_EXPIRY_LONG,
  REFRESH_TOKEN_EXPIRY_LONG_COOKIE,
} from '@/pages/lib/constants';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

export const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const generateTokens = (userId: string, grade: UserRole) => {
  const isAdmin = grade === 'ADMIN' || grade === 'SUPERUSER';
  const refreshTokenExpiry = isAdmin
    ? REFRESH_TOKEN_EXPIRY_LONG
    : REFRESH_TOKEN_EXPIRY;
  const refreshTokenMaxAge = isAdmin
    ? REFRESH_TOKEN_EXPIRY_LONG_COOKIE
    : REFRESH_TOKEN_EXPIRY_COOKIE;

  const accessToken = jwt.sign({ userId, grade }, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId, grade }, REFRESH_SECRET, {
    expiresIn: refreshTokenExpiry,
  });

  return { accessToken, refreshToken, refreshTokenMaxAge };
};

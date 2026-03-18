import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@/pages/lib/constants';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

export const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const generateTokens = (userId: string, grade: UserRole) => {
  const accessToken = jwt.sign({ userId, grade }, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId, grade }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken };
};

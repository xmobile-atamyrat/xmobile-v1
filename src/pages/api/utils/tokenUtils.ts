import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@/pages/lib/constants';
import jwt from 'jsonwebtoken';

export const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ id: userId }, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken };
};

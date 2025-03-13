import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { generateToken } from '@/pages/api/utils/tokenUtils';
import {
  ACCESS_TOKEN_EXPIRY,
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/user/signup.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<string>>,
) {
  addCors(res);
  const { method } = req;
  if (method === 'POST') {
    try {
      const { email, name, password, phoneNumber }: User = req.body;
      const existingUser = await dbClient.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        console.error(
          `${filepath}: user already exists. email: ${email}, name: ${name}`,
        );
        return res
          .status(400)
          .json({ success: false, message: 'userAlreadyExists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await dbClient.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          phoneNumber,
        },
      });
      delete user.password;

      const refreshToken = generateToken(
        user,
        process.env.NEXT_PUBLIC_JWT_AUTH_SECRET,
        REFRESH_TOKEN_EXPIRY,
      );
      const accessToken = generateToken(
        user,
        process.env.NEXT_PUBLIC_JWT_AUTH_SECRET,
        ACCESS_TOKEN_EXPIRY,
      );

      res.setHeader(
        'Set-Cookie',
        `${AUTH_REFRESH_COOKIE_NAME}=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRY_COOKIE}; Path=/`,
      );

      return res.status(200).json({
        success: true,
        data: accessToken,
      });
    } catch (error) {
      console.error(filepath, error);
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

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ACCESS_TOKEN_EXPIRY,
  AUTH_REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
import { generateToken } from '@/pages/api/utils/tokenUtils';

const filepath = 'src/pages/api/user/signin.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<string>>,
) {
  addCors(res);
  const { method } = req;
  if (method === 'POST') {
    try {
      const { email, password }: User = req.body;
      const user = await dbClient.user.findUnique({
        where: { email },
      });
      if (!user) {
        console.error(
          `${filepath}: user not found. email: ${email}, password: ${password}`,
        );
        return res
          .status(400)
          .json({ success: false, message: 'userNotFound' });
      }
      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        console.error(
          `${filepath}: password incorrect. email: ${email}, password: ${password}`,
        );
        return res
          .status(400)
          .json({ success: false, message: 'passwordIncorrect' });
      }
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
      console.error(error);
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

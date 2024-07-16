// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import dbClient from '@/lib/dbClient';
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/user/signin.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<User>>,
) {
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

      return res.status(200).json({
        success: true,
        data: user,
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

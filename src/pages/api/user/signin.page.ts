// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { User } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ResponseApi } from '@/pages/lib/types';
import dbClient from '@/lib/dbClient';
import bcrypt from 'bcryptjs';

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
        return res
          .status(400)
          .json({ success: false, message: 'userNotFound' });
      }
      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        return res
          .status(400)
          .json({ success: false, message: 'passwordIncorrect' });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message,
      });
    }
  }

  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

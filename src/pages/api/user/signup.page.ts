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
      const { email, name, password, phoneNumber }: User = req.body;
      const existingUser = await dbClient.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, message: 'User already exists' });
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

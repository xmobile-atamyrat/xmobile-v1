// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { User } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ResponseApi } from '@/pages/lib/types';
import dbClient from '@/lib/dbClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  switch (req.method) {
    case 'POST':
      try {
        const { email, name, password, phoneNumber }: User = req.body;
        const user = await dbClient.user.create({
          data: {
            email,
            name,
            password,
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
    default:
      return res
        .status(405)
        .json({ success: false, message: 'Method not allowed' });
  }
}

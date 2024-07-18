import addCors from '@/pages/api/utils/addCors';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  return res.status(200).json({ success: true, message: 'pong' });
}

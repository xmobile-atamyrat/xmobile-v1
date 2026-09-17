import addCors from '@/pages/api/utils/addCors';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (addCors(req, res)) return undefined;
  return res.status(200).json({ success: true, message: 'pong' });
}

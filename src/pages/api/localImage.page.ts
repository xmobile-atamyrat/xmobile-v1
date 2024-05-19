import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const {
    query: { imgUrl },
    method,
  } = req;

  if (method === 'GET') {
    if (fs.existsSync(imgUrl as string)) {
      const img = fs.readFileSync(imgUrl as string);
      res.setHeader('Content-Type', 'image/png');
      return res.status(200).send(img);
    }

    return res.status(404).send('Image not found');
  }
  if (method === 'DELETE') {
    if (fs.existsSync(imgUrl as string)) {
      fs.unlinkSync(imgUrl as string);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ success: false, message: 'Image not found' });
  }

  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

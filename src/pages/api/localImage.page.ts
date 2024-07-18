import addCors from '@/pages/api/utils/addCors';
import fs from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/localImage.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  addCors(res);
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

    console.error(
      filepath,
      'Image not found',
      `Method: ${method}`,
      `imgUrl: ${imgUrl}`,
    );
    return res.status(404).send('Image not found');
  }
  if (method === 'DELETE') {
    if (fs.existsSync(imgUrl as string)) {
      fs.unlinkSync(imgUrl as string);
      return res.status(200).json({ success: true });
    }

    console.error(
      filepath,
      'Image not found',
      `Method: ${method}`,
      `imgUrl: ${imgUrl}`,
    );
    return res.status(404).json({ success: false, message: 'Image not found' });
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

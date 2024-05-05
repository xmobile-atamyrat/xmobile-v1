import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const {
    query: { imgUrl },
  } = req;

  if (fs.existsSync(imgUrl as string)) {
    const img = fs.readFileSync(imgUrl as string);
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(img);
  }

  return res.status(404).send('Image not found');
}

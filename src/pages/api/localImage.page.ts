import addCors from '@/pages/api/utils/addCors';
import fs from 'fs';
import sharp from 'sharp';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/localImage.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  addCors(res);
  const {
    query: { imgUrl, network, quality },
    method,
  } = req;

  if (method === 'GET') {
    if (fs.existsSync(imgUrl as string)) {
      const img = fs.readFileSync(imgUrl as string);
      res.setHeader('Content-Type', 'image/png');

      if ((network as string) === 'fast' || img.length < 100 * 1024)
        return res.status(200).send(img);

      if ((network as string) !== 'slow')
        console.error(filepath, 'Network speed not found', `imgUrl: ${imgUrl}`);

      try {
        const compressImgParams: any = { quality: 50 };

        if ((quality as string) === 'bad') compressImgParams.quality = 5;

        const compressImg = sharp(img).png({ ...compressImgParams });
        return res.status(200).send(compressImg);
      } catch (error) {
        console.error(
          filepath,
          'Image compression failed',
          `imgUrl: ${imgUrl}`,
        );
        res.status(400).send('Image compression failed');
      }
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

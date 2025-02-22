import addCors from '@/pages/api/utils/addCors';
import fs from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import {
  createCompressedImg,
  createCompressedImgUrl,
} from '@/pages/api/product.page';

const filepath = 'src/pages/api/localImage.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  addCors(res);
  const {
    // todo: remove quality prop
    query: { imgUrl, network },
    method,
  } = req;

  if (method === 'GET') {
    if (imgUrl != null && fs.existsSync(imgUrl as string)) {
      const img = fs.readFileSync(imgUrl as string);
      const quality = network === 'fast' ? 'good' : 'bad';
      res.setHeader('Content-Type', 'image/jpeg');

      if ((network as string) !== 'slow' && (network as string) !== 'fast')
        console.error(filepath, 'Network speed not found', `imgUrl: ${imgUrl}`);

      try {
        const compressedImgUrl = createCompressedImgUrl(
          imgUrl as string,
          quality,
        );

        const compressedImg = fs.existsSync(compressedImgUrl)
          ? fs.readFileSync(compressedImgUrl)
          : await createCompressedImg(imgUrl as string, quality);

        return res.status(200).send(compressedImg);
      } catch (error) {
        console.error(
          filepath,
          'Image compression failed. Returned original image',
          `imgUrl: ${imgUrl}`,
          `error: ${error}`,
        );
        res.status(400).send(img);
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

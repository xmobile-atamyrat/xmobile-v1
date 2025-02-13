import addCors from '@/pages/api/utils/addCors';
import fs from 'fs';
import sharp, { PngOptions } from 'sharp';
import { IMG_COMPRESSION_QUALITY } from '@/pages/lib/constants';
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
    try {
      if (fs.existsSync(imgUrl as string)) {
        const img = fs.readFileSync(imgUrl as string);
        res.setHeader('Content-Type', 'image/png');

        try {
          if ((network as string) === 'fast' || img.length < 100 * 1024)
            // don't compress images under 100KB
            return res.status(200).send(img);

          if ((network as string) !== 'slow')
            console.error(
              filepath,
              'Network speed not found',
              `imgUrl: ${imgUrl}`,
            );
        } catch (error) {
          console.error(
            filepath,
            "Network status couldn't get identified",
            `error: ${error}`,
          );
          return res.status(200).send(img);
        }

        try {
          const compressImgParams: PngOptions = {
            quality:
              quality === 'bad'
                ? IMG_COMPRESSION_QUALITY.BAD
                : IMG_COMPRESSION_QUALITY.OKAY,
          };

          const compressImg = await sharp(img)
            .png({ ...compressImgParams })
            .toBuffer();
          return res.status(200).send(compressImg);
        } catch (error) {
          console.error(
            filepath,
            'Image compression failed',
            `imgUrl: ${imgUrl}`,
            `error: ${error}`,
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
    } catch (error) {
      console.error(filepath, 'Request is not valid.', `error: ${error}`);
      return res.status(500).send('Request is not valid.');
    }
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

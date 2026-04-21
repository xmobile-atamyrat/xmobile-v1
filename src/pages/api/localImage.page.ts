import dbClient from '@/lib/dbClient';
import {
  createCompressedImg,
  createCompressedImgUrl,
} from '@/pages/api/product/index.page';
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
    query: { imgUrl, network },
    method,
  } = req;

  if (method === 'GET') {
    if (imgUrl != null && fs.existsSync(imgUrl as string)) {
      const img = fs.readFileSync(imgUrl as string);
      const quality = network === 'fast' ? 'good' : 'bad';
      res.setHeader('Content-Type', 'image/jpeg');

      if ((network as string) !== 'slow' && (network as string) !== 'fast') {
        return res.status(200).send(img);
      }

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
        return res.status(400).send(img);
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
      try {
        const imgUrlStr = imgUrl as string;

        // Delete files
        fs.unlinkSync(imgUrlStr);
        const filename = imgUrlStr.split('/').pop();
        if (filename) {
          const baseDir = process.env.COMPRESSED_PRODUCT_IMAGES_DIR;
          if (baseDir) {
            ['bad', 'good'].forEach((quality) => {
              const compressedPath = `${baseDir}/${quality}/${filename}`;
              if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
            });
          }
        }

        const [products, categories] = await Promise.all([
          dbClient.product.findMany({
            where: { imgUrls: { has: imgUrlStr } },
            select: { id: true, imgUrls: true },
          }),
          dbClient.category.findMany({
            where: { imgUrl: imgUrlStr },
            select: { id: true },
          }),
        ]);

        await Promise.all([
          ...products.map((product) =>
            dbClient.product.update({
              where: { id: product.id },
              data: {
                imgUrls: product.imgUrls.filter((url) => url !== imgUrlStr),
              },
            }),
          ),
          ...categories.map((category) =>
            dbClient.category.update({
              where: { id: category.id },
              data: { imgUrl: null },
            }),
          ),
        ]);

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error(filepath, 'Error deleting image:', error);
        return res
          .status(500)
          .json({ success: false, message: 'Error deleting image' });
      }
    }

    return res.status(404).json({ success: false, message: 'Image not found' });
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

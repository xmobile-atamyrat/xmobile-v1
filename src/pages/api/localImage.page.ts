import dbClient from '@/lib/dbClient';
import {
  createCompressedImg,
  createCompressedImgUrl,
} from '@/pages/api/product/index.page';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import fs from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';

const filepath = 'src/pages/api/localImage.page.ts';

const IMAGE_DIR_ENV_KEYS = [
  'PRODUCT_IMAGES_DIR',
  'CATEGORY_IMAGES_DIR',
  'BANNER_IMAGES_DIR',
  'COMPRESSED_PRODUCT_IMAGES_DIR',
] as const;

// `imgUrl` is a filesystem path, so only paths inside the configured image
// folders are served or deleted. Anything else (/app/.env, ../../..) is
// answered as if the file did not exist.
function resolveImagePath(imgUrl: unknown): string | null {
  if (typeof imgUrl !== 'string' || imgUrl === '') return null;
  const resolved = path.resolve(imgUrl);
  const allowed = IMAGE_DIR_ENV_KEYS.some((key) => {
    const dir = process.env[key];
    return !!dir && resolved.startsWith(`${path.resolve(dir)}${path.sep}`);
  });
  return allowed ? resolved : null;
}

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
    const imgPath = resolveImagePath(imgUrl);
    if (imgPath != null && fs.existsSync(imgPath)) {
      const img = fs.readFileSync(imgPath);
      const quality = network === 'fast' ? 'good' : 'bad';
      res.setHeader('Content-Type', 'image/jpeg');

      if ((network as string) !== 'slow' && (network as string) !== 'fast') {
        return res.status(200).send(img);
      }

      try {
        const compressedImgUrl = createCompressedImgUrl(imgPath, quality);

        const compressedImg = fs.existsSync(compressedImgUrl)
          ? fs.readFileSync(compressedImgUrl)
          : await createCompressedImg(imgPath, quality);

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

    // A missing file is a bad or stale link (or a scanner probing the URL),
    // not a server fault, so it is a warning rather than an error alert.
    console.warn(
      filepath,
      'Image not found',
      `Method: ${method}`,
      `imgUrl: ${imgUrl}`,
    );
    return res.status(404).send('Image not found');
  }

  if (method === 'DELETE') {
    if (!(await requireStaffBearerAuth(req, res))) return undefined;

    const imgPath = resolveImagePath(imgUrl);
    if (imgPath != null && fs.existsSync(imgPath)) {
      try {
        // Products and categories store the path as it was given.
        const imgUrlStr = imgUrl as string;

        // Delete files
        fs.unlinkSync(imgPath);
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

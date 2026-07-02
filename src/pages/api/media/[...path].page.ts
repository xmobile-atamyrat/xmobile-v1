import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const segments = req.query.path as string[];
  let filePath: string | null = null;

  if (segments[0] === 'category' && segments.length === 2) {
    const dir = process.env.CATEGORY_IMAGES_DIR;
    if (dir) filePath = path.resolve(process.cwd(), dir, segments[1]);
  } else if (segments[0] === 'banner' && segments.length === 2) {
    const dir = process.env.BANNER_IMAGES_DIR;
    if (dir) filePath = path.resolve(process.cwd(), dir, segments[1]);
  } else if (segments[0] === 'product' && segments.length === 3) {
    const [, tier, filename] = segments;
    if (tier === 'original') {
      const dir = process.env.PRODUCT_IMAGES_DIR;
      if (dir) filePath = path.resolve(process.cwd(), dir, filename);
    } else if (tier === 'bad' || tier === 'good') {
      const dir = process.env.COMPRESSED_PRODUCT_IMAGES_DIR;
      if (dir) filePath = path.resolve(process.cwd(), dir, tier, filename);
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).end();
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  return res.status(200).send(fs.readFileSync(filePath));
}

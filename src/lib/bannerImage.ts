import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

import { bannerCropSize } from '../pages/lib/bannerCrop';

const BANNER_WEBP_QUALITY = 80;

/**
 * Writes a centre-cropped 2:1 WebP next to `sourcePath` and returns its path.
 * The crop matches what the storefront's `object-cover` slide shows, so the
 * visible result is unchanged. The source file is left in place.
 */
export async function writeBannerWebp(sourcePath: string): Promise<string> {
  // Read into memory so sharp holds no file handle and the caller can unlink the source.
  const input = await fs.readFile(sourcePath);
  const { width, height, orientation, format } = await sharp(input).metadata();
  if (!width || !height) throw new Error(`Unreadable image: ${sourcePath}`);

  // EXIF orientations 5-8 are rotated 90°, so the displayed width is the stored height.
  const rotated = (orientation ?? 1) >= 5;
  const crop = bannerCropSize(
    rotated ? height : width,
    rotated ? width : height,
  );

  // The admin dialog already uploads a cropped WebP; re-encoding it would only lose quality.
  const alreadyCropped =
    format === 'webp' &&
    (orientation ?? 1) === 1 &&
    width === crop.width &&
    height === crop.height;
  const output = alreadyCropped
    ? input
    : await sharp(input)
        .rotate()
        .resize({ ...crop, fit: 'cover', position: 'centre' })
        .webp({ quality: BANNER_WEBP_QUALITY })
        .toBuffer();

  const { dir, name } = path.parse(sourcePath);
  const targetPath = path.join(
    dir,
    `${name}-${crop.width}x${crop.height}.webp`,
  );
  await fs.writeFile(targetPath, new Uint8Array(output));
  return targetPath;
}

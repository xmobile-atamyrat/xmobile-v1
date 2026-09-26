import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import {
  BANNER_IMAGE_HEIGHT,
  BANNER_IMAGE_WIDTH,
} from '../pages/lib/constants';

const BANNER_WEBP_QUALITY = 80;

export function bannerCropSize(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const ratio = BANNER_IMAGE_WIDTH / BANNER_IMAGE_HEIGHT;
  let width = Math.min(sourceWidth, BANNER_IMAGE_WIDTH);
  let height = Math.round(width / ratio);
  if (height > sourceHeight) {
    height = sourceHeight;
    width = Math.round(height * ratio);
  }
  return { width, height };
}

/**
 * Writes a centre-cropped 2:1 WebP next to `sourcePath` and returns its path.
 * The crop matches what the storefront's `object-cover` slide shows, so the
 * visible result is unchanged. The source file is left in place.
 */
export async function writeBannerWebp(sourcePath: string): Promise<string> {
  // Read into memory so sharp holds no file handle and the caller can unlink the source.
  const input = fs.readFileSync(sourcePath);
  const { width, height, orientation } = await sharp(input).metadata();
  if (!width || !height) throw new Error(`Unreadable image: ${sourcePath}`);

  // EXIF orientations 5-8 are rotated 90°, so the displayed width is the stored height.
  const rotated = (orientation ?? 1) >= 5;
  const crop = bannerCropSize(
    rotated ? height : width,
    rotated ? width : height,
  );

  const output = await sharp(input)
    .rotate()
    .resize({ ...crop, fit: 'cover', position: 'centre' })
    .webp({ quality: BANNER_WEBP_QUALITY })
    .toBuffer();

  const { dir, name } = path.parse(sourcePath);
  const targetPath = path.join(
    dir,
    `${name}-${crop.width}x${crop.height}.webp`,
  );
  fs.writeFileSync(targetPath, new Uint8Array(output));
  return targetPath;
}

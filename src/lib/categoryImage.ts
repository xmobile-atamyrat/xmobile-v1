import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

// The widest category image on the storefront is the 354px category card; this covers it at 2x.
export const CATEGORY_IMAGE_MAX_WIDTH = 720;
const CATEGORY_WEBP_QUALITY = 80;

/**
 * Writes the upload at `sourcePath` as a WebP no wider than
 * CATEGORY_IMAGE_MAX_WIDTH, removes the source and returns the new path. An
 * upload that would not get smaller is kept as-is and its own path returned.
 */
export async function writeCategoryWebp(sourcePath: string): Promise<string> {
  const input = await fs.readFile(sourcePath);
  const output = await sharp(input)
    .rotate()
    .resize({ width: CATEGORY_IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: CATEGORY_WEBP_QUALITY })
    .toBuffer();
  if (output.length >= input.length) return sourcePath;

  const { dir, name } = path.parse(sourcePath);
  const targetPath = path.join(dir, `${name}.webp`);
  await fs.writeFile(targetPath, new Uint8Array(output));
  if (targetPath !== sourcePath) await fs.unlink(sourcePath);
  return targetPath;
}

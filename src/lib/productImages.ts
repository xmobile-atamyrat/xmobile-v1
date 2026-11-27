import {
  IMG_COMPRESSION_MAX_QUALITY,
  IMG_COMPRESSION_MIN_QUALITY,
  IMG_COMPRESSION_OPTIONS,
} from '@/pages/lib/constants';
import dbClient from '@/lib/dbClient';
import { isRemoteImageUrl } from '@/pages/lib/mediaUrls';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const filepath = 'src/lib/productImages.ts';

/**
 * Largest full-size image whose raw pixels `createCompressedImg` keeps
 * between quality passes: 3000x3000, about 27 MB as RGB.
 */
const MAX_RAW_PASS_PIXELS = 9_000_000;

// changes url from images/products/img -> images/compressed/products/img
export function createCompressedImgUrl(
  imgUrl: string,
  type: 'bad' | 'good',
): string | null {
  // A pasted external URL has no file on disk, so no compressed copy either.
  if (isRemoteImageUrl(imgUrl)) return null;

  // Windows uses '\' in path format, replace it with '/'
  const normalizedUrl = imgUrl.replace(/\\/g, '/');
  const imgName = path.basename(imgUrl);

  if (!normalizedUrl.includes('products/')) {
    console.error(
      filepath,
      "incorrect imgUrl, products folder doesn't exist in image path: ",
      imgUrl,
    );
  }

  return `${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/${imgName}`;
}

/** Removes a product image and its compressed copies from disk. */
export function deleteProductImageFiles(imgUrl: string) {
  if (isRemoteImageUrl(imgUrl)) return;
  [
    imgUrl,
    createCompressedImgUrl(imgUrl, 'bad'),
    createCompressedImgUrl(imgUrl, 'good'),
  ].forEach((file) => {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  });
}

export type RemovedImageFiles = 'deleted' | 'in use' | 'external' | 'failed';

/**
 * Deletes the files of an image taken off a product, once no product lists
 * it any more, a soft-deleted one included, since that can be restored. Call
 * it after the product is saved without the image. The compressed copies,
 * which /media serves, are named by the file's base name alone, so another
 * product counts as a user when any of its images has the same base name,
 * whatever directory its stored path names.
 */
export async function deleteUnusedProductImageFiles(
  imgUrl: string,
): Promise<RemovedImageFiles> {
  if (isRemoteImageUrl(imgUrl)) return 'external';
  const name = path.posix.basename(imgUrl.replace(/\\/g, '/'));
  try {
    // chr(92) is a backslash: Windows-style stored paths count too.
    const [{ users }] = await dbClient.$queryRaw<{ users: number }[]>(
      Prisma.sql`
        SELECT count(*)::int AS users FROM "Product"
        WHERE EXISTS (
          SELECT 1 FROM unnest("imgUrls") AS stored
          WHERE reverse(split_part(reverse(replace(stored, chr(92), '/')), '/', 1)) = ${name}
        )`,
    );
    if (users > 0) return 'in use';
    deleteProductImageFiles(imgUrl);
    return 'deleted';
  } catch (error) {
    console.error(filepath, 'could not delete a removed image', imgUrl, error);
    return 'failed';
  }
}

/**
 * Writes the `type` compressed copy of the image at `imgUrl`. Pass `source`
 * when its bytes are already in memory, so they aren't read back from disk.
 */
export async function createCompressedImg(
  imgUrl: string,
  type: 'bad' | 'good',
  source?: Buffer,
): Promise<Buffer> | null {
  if (imgUrl != null && (source != null || fs.existsSync(imgUrl))) {
    try {
      await fs.promises.mkdir(
        `${process.env.COMPRESSED_PRODUCT_IMAGES_DIR}/${type}/`,
        { recursive: true },
      );
      const img = source ?? (await fs.promises.readFile(imgUrl));
      let compressedImg: Buffer = img;

      const targetUrl = createCompressedImgUrl(imgUrl, type);
      const targetSize = IMG_COMPRESSION_OPTIONS[type].size;
      const targetWidth =
        IMG_COMPRESSION_OPTIONS[type].width === 0
          ? null
          : IMG_COMPRESSION_OPTIONS[type].width;
      let quality = IMG_COMPRESSION_MAX_QUALITY;
      // The image is decoded once into raw pixels and each pass only encodes
      // again, when those pixels are small enough to hold: always for a
      // resized tier, and for a full-size one up to MAX_RAW_PASS_PIXELS.
      // Past that, each pass decodes the source again rather than hold
      // hundreds of MB.
      const { width = 0, height = 0 } =
        targetWidth == null ? await sharp(img).metadata() : {};
      const holdPixels =
        targetWidth != null || width * height <= MAX_RAW_PASS_PIXELS;
      let pixels: { data: Buffer; info: sharp.OutputInfo } | null = null;
      const encode = async (passQuality: number): Promise<Buffer> => {
        if (!holdPixels) {
          return (
            sharp(img)
              // JPEG has no alpha; without this, transparent pixels turn black.
              .flatten({ background: '#ffffff' })
              .jpeg({ quality: passQuality, progressive: true })
              .toBuffer()
          );
        }
        pixels ??= await (
          targetWidth == null
            ? sharp(img)
            : sharp(img).resize({ width: targetWidth })
        )
          .flatten({ background: '#ffffff' })
          .raw()
          .toBuffer({ resolveWithObject: true });
        return sharp(pixels.data, {
          raw: {
            width: pixels.info.width,
            height: pixels.info.height,
            channels: pixels.info.channels,
          },
        })
          .jpeg({ quality: passQuality, progressive: true })
          .toBuffer();
      };

      while (
        compressedImg.length > targetSize &&
        quality > IMG_COMPRESSION_MIN_QUALITY
      ) {
        compressedImg = await encode(quality);
        quality -= 10;
      }
      await fs.promises.writeFile(targetUrl, new Uint8Array(compressedImg));

      return compressedImg;
    } catch (error) {
      console.error(filepath, 'function createCompressedImg:', error);
      return null;
    }
  } else {
    console.error(filepath, `image not found: ${imgUrl}`);
    return null;
  }
}

export type StoredImageFormat = 'jpeg' | 'png' | 'webp';

/** Detects the format from the file's first bytes, never from a name or header. */
export function sniffImageFormat(buffer: Buffer): StoredImageFormat | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Refuses decompression bombs, and photos too big to decode on the VM, before
 * sharp allocates the pixels: 25 MP is about 100 MB decoded as RGBA.
 */
export const MAX_IMAGE_INPUT_PIXELS = 25_000_000;
/** Longest side kept on disk; larger images are scaled down to it. */
export const MAX_STORED_IMAGE_SIDE = 3000;
export const MIN_STORED_IMAGE_SIDE = 100;

export class ProductImageError extends Error {}

/**
 * How many `storeProductImage` calls decode at once. Each can hold a few
 * hundred MB, on a 4 GB VM that also runs the shop and Postgres; the rest wait
 * their turn.
 */
const MAX_CONCURRENT_STORES = 2;
let activeStores = 0;
const waitingStores: (() => void)[] = [];

async function withStoreSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeStores < MAX_CONCURRENT_STORES) {
    activeStores += 1;
  } else {
    // Woken by a finishing call, which hands its slot over.
    await new Promise<void>((resolve) => {
      waitingStores.push(resolve);
    });
  }
  try {
    return await run();
  } finally {
    const next = waitingStores.shift();
    if (next != null) next();
    else activeStores -= 1;
  }
}

async function storeOneImage(buffer: Buffer): Promise<string> {
  const dir = process.env.PRODUCT_IMAGES_DIR;
  if (!dir) throw new Error('PRODUCT_IMAGES_DIR is not set');
  const format = sniffImageFormat(buffer);
  if (format == null) {
    throw new ProductImageError('Only JPEG, PNG and WebP images are accepted');
  }

  let output: Buffer;
  try {
    // The header alone, under sharp's own (much higher) limit, so an image
    // over ours is refused saying so; the decode below enforces ours.
    const { width, height } = await sharp(buffer).metadata();
    if (
      width == null ||
      height == null ||
      Math.min(width, height) < MIN_STORED_IMAGE_SIDE
    ) {
      throw new ProductImageError(
        `The image must be at least ${MIN_STORED_IMAGE_SIDE}px on each side`,
      );
    }
    if (width * height > MAX_IMAGE_INPUT_PIXELS) {
      throw new ProductImageError(
        `The image is larger than ${MAX_IMAGE_INPUT_PIXELS / 1_000_000} megapixels; send a smaller one`,
      );
    }
    const pipeline = sharp(buffer, {
      limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: MAX_STORED_IMAGE_SIDE,
        height: MAX_STORED_IMAGE_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    if (format === 'jpeg') {
      output = await pipeline
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();
    } else if (format === 'png') {
      // sharp's default level: 9 is several times slower for a few percent.
      output = await pipeline.png({ compressionLevel: 6 }).toBuffer();
    } else {
      output = await pipeline.webp({ quality: 90 }).toBuffer();
    }
  } catch (error) {
    if (error instanceof ProductImageError) throw error;
    throw new ProductImageError('The file could not be read as an image');
  }

  await fs.promises.mkdir(dir, { recursive: true });
  const ext = format === 'jpeg' ? 'jpg' : format;
  const storedPath = path.join(dir, `mcp-${crypto.randomUUID()}.${ext}`);
  await fs.promises.writeFile(storedPath, new Uint8Array(output), {
    flag: 'wx',
  });
  // From the bytes in memory, not read back from the file just written.
  const [bad, good] = await Promise.all([
    createCompressedImg(storedPath, 'bad', output),
    createCompressedImg(storedPath, 'good', output),
  ]);
  if (bad == null || good == null) {
    deleteProductImageFiles(storedPath);
    throw new Error('Could not create the compressed copies');
  }
  return storedPath;
}

/**
 * Saves an image that did not come through the admin form (the MCP tools) the
 * way the form's uploads end up: original in `PRODUCT_IMAGES_DIR`, plus the
 * `bad` and `good` compressed copies. Unlike the form, the bytes are decoded
 * and re-encoded first, which drops metadata and anything that is not pixels
 * (a file that is also a script, say), and the name is generated here.
 * At most `MAX_CONCURRENT_STORES` run at once. Returns the stored path, which is what `Product.imgUrls` holds.
 */
export async function storeProductImage(buffer: Buffer): Promise<string> {
  return withStoreSlot(() => storeOneImage(buffer));
}

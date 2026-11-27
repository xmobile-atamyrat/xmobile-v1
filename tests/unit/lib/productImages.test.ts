import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createCompressedImgUrl,
  MAX_IMAGE_INPUT_PIXELS,
  MAX_STORED_IMAGE_SIDE,
  ProductImageError,
  sniffImageFormat,
  storeProductImage,
} from '@/lib/productImages';

function solid(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 10, g: 120, b: 200, alpha: 1 },
    },
  });
}

describe('sniffImageFormat', () => {
  it('detects by content, not by name', async () => {
    expect(sniffImageFormat(await solid(4, 4).png().toBuffer())).toBe('png');
    expect(sniffImageFormat(await solid(4, 4).jpeg().toBuffer())).toBe('jpeg');
    expect(sniffImageFormat(await solid(4, 4).webp().toBuffer())).toBe('webp');
    expect(sniffImageFormat(Buffer.from('<svg xmlns="..."/>'))).toBeNull();
    expect(sniffImageFormat(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImageFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe('storeProductImage', () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'store-image-'));
  });

  beforeEach(() => {
    vi.stubEnv('PRODUCT_IMAGES_DIR', path.join(root, 'products'));
    vi.stubEnv('COMPRESSED_PRODUCT_IMAGES_DIR', path.join(root, 'compressed'));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('writes the original and both compressed copies under a generated name', async () => {
    const stored = await storeProductImage(
      await solid(800, 600).png().toBuffer(),
    );
    expect(path.dirname(stored)).toBe(path.join(root, 'products'));
    expect(path.basename(stored)).toMatch(/^mcp-[0-9a-f-]{36}\.png$/);
    expect(fs.existsSync(stored)).toBe(true);
    expect(fs.existsSync(createCompressedImgUrl(stored, 'bad')!)).toBe(true);
    expect(fs.existsSync(createCompressedImgUrl(stored, 'good')!)).toBe(true);
  });

  it('re-encodes, dropping metadata', async () => {
    const withExif = await solid(400, 400)
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-note' } } })
      .toBuffer();
    expect(withExif.includes(Buffer.from('secret-note'))).toBe(true);
    const stored = await storeProductImage(withExif);
    expect(path.extname(stored)).toBe('.jpg');
    expect(fs.readFileSync(stored).includes(Buffer.from('secret-note'))).toBe(
      false,
    );
  });

  it('drops bytes appended after the image', async () => {
    const polyglot = Buffer.concat([
      await solid(300, 300).png().toBuffer(),
      Buffer.from('<script>alert(1)</script>'),
    ]);
    const stored = await storeProductImage(polyglot);
    expect(fs.readFileSync(stored).includes(Buffer.from('<script>'))).toBe(
      false,
    );
  });

  it('scales a huge image down', async () => {
    const stored = await storeProductImage(
      await solid(MAX_STORED_IMAGE_SIDE + 500, 400)
        .webp()
        .toBuffer(),
    );
    const { width } = await sharp(fs.readFileSync(stored)).metadata();
    expect(width).toBe(MAX_STORED_IMAGE_SIDE);
  });

  it('refuses what is not a JPEG, PNG or WebP', async () => {
    await expect(
      storeProductImage(Buffer.from('<svg onload="x"/>')),
    ).rejects.toBeInstanceOf(ProductImageError);
  });

  it('refuses a truncated image', async () => {
    const png = await solid(400, 400).png().toBuffer();
    await expect(storeProductImage(png.subarray(0, 60))).rejects.toBeInstanceOf(
      ProductImageError,
    );
  });

  it('refuses an image over the pixel limit, saying why', async () => {
    const side = Math.ceil(Math.sqrt(MAX_IMAGE_INPUT_PIXELS)) + 1;
    await expect(
      storeProductImage(await solid(side, side).png().toBuffer()),
    ).rejects.toThrow(/megapixels/);
  });

  it('refuses a tiny image', async () => {
    await expect(
      storeProductImage(await solid(50, 400).png().toBuffer()),
    ).rejects.toThrow(/at least/);
  });
});

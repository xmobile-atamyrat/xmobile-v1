import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bannerCropSize, writeBannerWebp } from '@/lib/bannerImage';

describe('bannerCropSize', () => {
  it('crops a tall upload to 1600x800', () => {
    expect(bannerCropSize(1600, 2840)).toEqual({ width: 1600, height: 800 });
  });

  it('crops a very wide upload by height', () => {
    expect(bannerCropSize(4000, 600)).toEqual({ width: 1200, height: 600 });
  });

  it('never enlarges a small upload', () => {
    expect(bannerCropSize(800, 600)).toEqual({ width: 800, height: 400 });
  });
});

describe('writeBannerWebp', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banner-webp-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a 2:1 WebP next to the source and keeps the source', async () => {
    const source = path.join(dir, 'upload');
    await sharp({
      create: {
        width: 1600,
        height: 2840,
        channels: 4,
        background: { r: 200, g: 30, b: 60, alpha: 0.5 },
      },
    })
      .png()
      .toFile(source);

    const target = await writeBannerWebp(source);

    expect(target).toBe(path.join(dir, 'upload-1600x800.webp'));
    expect(fs.existsSync(source)).toBe(true);
    const meta = await sharp(fs.readFileSync(target)).metadata();
    expect(meta).toMatchObject({
      format: 'webp',
      width: 1600,
      height: 800,
      hasAlpha: true,
    });
  });

  it('honours EXIF rotation when choosing the crop', async () => {
    const source = path.join(dir, 'rotated.jpg');
    await sharp({
      create: {
        width: 1000,
        height: 3000,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(source);

    const target = await writeBannerWebp(source);

    const meta = await sharp(fs.readFileSync(target)).metadata();
    expect(meta).toMatchObject({ width: 1600, height: 800 });
  });

  it('rejects a file that is not an image', async () => {
    const source = path.join(dir, 'not-an-image');
    fs.writeFileSync(source, 'hello');

    await expect(writeBannerWebp(source)).rejects.toThrow();
  });
});

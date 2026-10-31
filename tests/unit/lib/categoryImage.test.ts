import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeCategoryWebp } from '@/lib/categoryImage';

const noise = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: 'gaussian', mean: 128, sigma: 30 },
    },
  });

describe('writeCategoryWebp', () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'category-webp-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shrinks a wide upload to a 720px WebP and removes the source', async () => {
    const source = path.join(dir, 'upload');
    await sharp({
      create: {
        width: 1024,
        height: 682,
        channels: 4,
        background: { r: 200, g: 30, b: 60, alpha: 0.5 },
      },
    })
      .png()
      .toFile(source);

    const target = await writeCategoryWebp(source);

    expect(target).toBe(path.join(dir, 'upload.webp'));
    expect(fs.existsSync(source)).toBe(false);
    const meta = await sharp(fs.readFileSync(target)).metadata();
    expect(meta).toMatchObject({
      format: 'webp',
      width: 720,
      height: 480,
      hasAlpha: true,
    });
  });

  it('never enlarges a narrow upload', async () => {
    const source = path.join(dir, 'narrow.jpg');
    await noise(240, 160).jpeg({ quality: 100 }).toFile(source);

    const target = await writeCategoryWebp(source);

    expect(target).toBe(path.join(dir, 'narrow.webp'));
    const meta = await sharp(fs.readFileSync(target)).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 240, height: 160 });
  });

  it('keeps an upload that would not get smaller', async () => {
    const source = path.join(dir, 'tiny');
    await noise(64, 64).webp({ quality: 5 }).toFile(source);
    const before = fs.readFileSync(source);

    const target = await writeCategoryWebp(source);

    expect(target).toBe(source);
    expect(fs.readFileSync(source).equals(before)).toBe(true);
  });

  it('rejects a file that is not an image', async () => {
    const source = path.join(dir, 'not-an-image');
    fs.writeFileSync(source, 'hello');

    await expect(writeCategoryWebp(source)).rejects.toThrow();
  });
});

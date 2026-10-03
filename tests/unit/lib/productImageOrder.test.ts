import { describe, expect, it } from 'vitest';

import {
  applyImageOrder,
  fileToken,
  parseImageOrder,
} from '@/lib/productImageOrder';

const kept = (path: string) => ({ token: path, path });
const upload = (index: number, path: string) => ({
  token: fileToken(index),
  path,
});

describe('applyImageOrder', () => {
  it('keeps the incoming order when no order is given', () => {
    const images = [kept('a.jpg'), kept('b.jpg'), upload(0, 'up0.jpg')];
    expect(applyImageOrder(images, null)).toEqual([
      'a.jpg',
      'b.jpg',
      'up0.jpg',
    ]);
  });

  it('interleaves uploads with existing images in the admin-chosen order', () => {
    const images = [
      kept('a.jpg'),
      kept('b.jpg'),
      upload(0, 'up0.jpg'),
      upload(1, 'up1.jpg'),
    ];
    expect(
      applyImageOrder(images, ['file:1', 'b.jpg', 'file:0', 'a.jpg']),
    ).toEqual(['up1.jpg', 'b.jpg', 'up0.jpg', 'a.jpg']);
  });

  it('ignores tokens that do not name an image in the set', () => {
    // The order may only rearrange what the server already accepted; a token
    // pointing anywhere else must not smuggle a new path into imgUrls.
    const images = [kept('a.jpg'), kept('b.jpg')];
    expect(
      applyImageOrder(images, ['/etc/passwd', 'b.jpg', 'file:9', 'a.jpg']),
    ).toEqual(['b.jpg', 'a.jpg']);
  });

  it('appends images the order forgot instead of dropping them', () => {
    const images = [kept('a.jpg'), kept('b.jpg'), upload(0, 'up0.jpg')];
    expect(applyImageOrder(images, ['up0.jpg', 'b.jpg'])).toEqual([
      'b.jpg',
      'a.jpg',
      'up0.jpg',
    ]);
  });

  it('places each duplicate token once', () => {
    const images = [kept('a.jpg'), kept('a.jpg'), kept('b.jpg')];
    expect(applyImageOrder(images, ['b.jpg', 'a.jpg', 'a.jpg'])).toEqual([
      'b.jpg',
      'a.jpg',
      'a.jpg',
    ]);
    expect(applyImageOrder(images, ['a.jpg', 'a.jpg', 'a.jpg'])).toEqual([
      'a.jpg',
      'a.jpg',
      'b.jpg',
    ]);
  });
});

describe('parseImageOrder', () => {
  it('reads a JSON string array', () => {
    expect(parseImageOrder('["a.jpg","file:0"]')).toEqual(['a.jpg', 'file:0']);
  });

  it('returns null for anything else', () => {
    expect(parseImageOrder(undefined)).toBeNull();
    expect(parseImageOrder('not json')).toBeNull();
    expect(parseImageOrder('{"a":1}')).toBeNull();
    expect(parseImageOrder('[1,2]')).toBeNull();
  });
});

import {
  getAbsoluteCategoryMediaUrl,
  getAbsoluteProductMediaUrl,
  getBannerMediaUrl,
  getBasename,
  getCategoryMediaUrl,
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  productThumbnailUrl,
  tierForProductGallery,
} from '@/pages/lib/mediaUrls';
import { describe, expect, it } from 'vitest';

describe('mediaUrls', () => {
  it('getBasename handles unix paths', () => {
    expect(getBasename('/home/ubuntu/images/products/foo.jpg')).toBe('foo.jpg');
    expect(getBasename('foo.jpg')).toBe('foo.jpg');
  });

  it('getBasename normalizes backslashes', () => {
    expect(getBasename(String.raw`C:\data\bar.png`)).toBe('bar.png');
  });

  it('getProductMediaUrl returns remote URLs unchanged', () => {
    expect(getProductMediaUrl('bad', 'https://cdn.example.com/a.jpg')).toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  it('getProductMediaUrl maps local paths to nginx tiers', () => {
    expect(
      getProductMediaUrl('original', '/home/ubuntu/images/products/kIWmutest'),
    ).toBe('/media/product/original/kIWmutest');
    expect(
      getProductMediaUrl('good', '/home/ubuntu/images/products/kIWmutest'),
    ).toBe('/media/product/good/kIWmutest');
    expect(
      getProductMediaUrl('bad', '/home/ubuntu/images/products/kIWmutest'),
    ).toBe('/media/product/bad/kIWmutest');
  });

  it('getCategoryMediaUrl maps local paths', () => {
    expect(getCategoryMediaUrl('/home/ubuntu/images/categories/cat.jpg')).toBe(
      '/media/category/cat.jpg',
    );
  });

  it('getBannerMediaUrl maps local paths', () => {
    expect(getBannerMediaUrl('/home/ubuntu/images/banners/promo.jpg')).toBe(
      '/media/banner/promo.jpg',
    );
  });

  it('getBannerMediaUrl returns remote URLs unchanged', () => {
    expect(getBannerMediaUrl('https://cdn.example.com/promo.jpg')).toBe(
      'https://cdn.example.com/promo.jpg',
    );
  });

  it('getBannerMediaUrl returns undefined for nullish input', () => {
    expect(getBannerMediaUrl(null)).toBeUndefined();
    expect(getBannerMediaUrl(undefined)).toBeUndefined();
  });

  it('tierForProductGallery', () => {
    expect(tierForProductGallery('fast')).toBe('good');
    expect(tierForProductGallery('slow')).toBe('bad');
    expect(tierForProductGallery('unknown')).toBe('bad');
  });

  it('getAbsoluteProductMediaUrl', () => {
    expect(
      getAbsoluteProductMediaUrl(
        'https://xmobile.com.tm',
        'good',
        '/home/ubuntu/images/products/x',
      ),
    ).toBe('https://xmobile.com.tm/media/product/good/x');
  });

  it('getAbsoluteCategoryMediaUrl', () => {
    expect(
      getAbsoluteCategoryMediaUrl(
        'https://xmobile.com.tm',
        '/home/ubuntu/images/categories/y.png',
      ),
    ).toBe('https://xmobile.com.tm/media/category/y.png');
  });

  it('productThumbnailUrl uses the thumbnail tier', () => {
    expect(productThumbnailUrl('/home/ubuntu/images/products/a.jpg')).toBe(
      '/media/product/bad/a.jpg',
    );
    expect(productThumbnailUrl('HTTPS://cdn.example.com/a.jpg')).toBe(
      'HTTPS://cdn.example.com/a.jpg',
    );
  });

  it('productThumbnailUrl falls back only for an unusable path', () => {
    expect(productThumbnailUrl('')).toBe(PRODUCT_IMAGE_FALLBACK);
    expect(productThumbnailUrl(undefined)).toBeUndefined();
  });
});

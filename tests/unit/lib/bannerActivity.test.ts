import { describe, expect, it } from 'vitest';

import { buildBannerUpdateMeta } from '@/lib/bannerActivity';
import type { PromoBanner } from '@prisma/client';

const banner: PromoBanner = {
  id: 'b1',
  imgUrls: { default: '/media/a.webp' },
  redirectCategoryId: null,
  redirectProductId: null,
  isActive: true,
  sortOrder: 2,
  startsAt: null,
  endsAt: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as PromoBanner;

describe('buildBannerUpdateMeta', () => {
  it('returns null when nothing changed', () => {
    expect(buildBannerUpdateMeta(banner, { ...banner })).toBeNull();
  });

  it('records toggled visibility and a moved position', () => {
    expect(
      buildBannerUpdateMeta(banner, {
        ...banner,
        isActive: false,
        sortOrder: 3,
      }),
    ).toEqual({
      position: 3,
      changes: {
        isActive: { from: true, to: false },
        sortOrder: { from: 2, to: 3 },
      },
    });
  });

  it('records a schedule change', () => {
    const endsAt = new Date('2026-12-31');
    expect(buildBannerUpdateMeta(banner, { ...banner, endsAt })).toEqual({
      position: 2,
      changes: { endsAt: { from: null, to: endsAt } },
    });
  });

  it('flags image and redirect changes without storing the paths', () => {
    expect(
      buildBannerUpdateMeta(banner, {
        ...banner,
        imgUrls: { default: '/media/b.webp' },
        redirectCategoryId: 'c1',
      }),
    ).toEqual({
      position: 2,
      changes: {},
      redirectChanged: true,
      imagesChanged: true,
    });
  });
});

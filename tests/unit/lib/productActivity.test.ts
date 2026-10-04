import { describe, expect, it } from 'vitest';

import { buildProductUpdateActivity, imageDiff } from '@/lib/productActivity';
import type { Product } from '@prisma/client';

const product = {
  id: 'p1',
  name: '{"en":"iPhone 15"}',
  description: '{"en":"Phone"}',
  categoryId: 'c1',
  brandId: 'b1',
  tags: ['128gb'],
  videoUrls: [],
  imgUrls: ['a.jpg', 'b.jpg', 'c.jpg'],
  price: 'price-1',
  outOfStockAt: null,
} as unknown as Product;

const noNames: {
  category: { from: string | null; to: string | null };
  brand: { from: string | null; to: string | null };
} = {
  category: { from: null, to: null },
  brand: { from: null, to: null },
};

describe('imageDiff', () => {
  it('counts added and removed images', () => {
    expect(imageDiff(['a', 'b'], ['b', 'c', 'd'])).toEqual({
      added: 2,
      removed: 1,
      reordered: false,
    });
  });

  it('detects a pure reorder', () => {
    expect(imageDiff(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual({
      added: 0,
      removed: 0,
      reordered: true,
    });
  });

  it('reports no change for identical lists', () => {
    expect(imageDiff(['a', 'b'], ['a', 'b'])).toEqual({
      added: 0,
      removed: 0,
      reordered: false,
    });
  });

  it('does not call a removal a reorder', () => {
    expect(imageDiff(['a', 'b', 'c'], ['a', 'c'])).toEqual({
      added: 0,
      removed: 1,
      reordered: false,
    });
  });
});

describe('buildProductUpdateActivity', () => {
  it('returns null when nothing changed', () => {
    expect(
      buildProductUpdateActivity(product, { ...product }, noNames),
    ).toBeNull();
  });

  it('ignores edits to locales other than the shown label', () => {
    expect(
      buildProductUpdateActivity(
        product,
        { ...product, name: '{"en":"iPhone 15","ru":"Айфон 15"}' },
        noNames,
      ),
    ).toBeNull();
  });

  it('logs a pure image reorder as REORDER', () => {
    expect(
      buildProductUpdateActivity(
        product,
        { ...product, imgUrls: ['c.jpg', 'a.jpg', 'b.jpg'] },
        noNames,
      ),
    ).toEqual({ action: 'REORDER', meta: { name: 'iPhone 15' } });
  });

  it('records renames, moves, brand changes and stock flips', () => {
    expect(
      buildProductUpdateActivity(
        product,
        {
          ...product,
          name: '{"en":"iPhone 15 Pro"}',
          categoryId: 'c2',
          brandId: 'b2',
          outOfStockAt: new Date('2026-10-01'),
        },
        {
          category: { from: 'Phones', to: 'Premium' },
          brand: { from: 'Apple', to: null },
        },
      ),
    ).toEqual({
      action: 'UPDATE',
      meta: {
        name: 'iPhone 15 Pro',
        changes: {
          name: { from: 'iPhone 15', to: 'iPhone 15 Pro' },
          category: { from: 'Phones', to: 'Premium' },
          brand: { from: 'Apple', to: null },
          outOfStock: { from: false, to: true },
        },
      },
    });
  });

  it('lists fields without a readable diff and counts image changes', () => {
    expect(
      buildProductUpdateActivity(
        product,
        {
          ...product,
          description: '{"en":"New"}',
          tags: ['256gb'],
          price: 'price-2',
          imgUrls: ['a.jpg', 'b.jpg', 'd.jpg', 'e.jpg'],
        },
        noNames,
      ),
    ).toEqual({
      action: 'UPDATE',
      meta: {
        name: 'iPhone 15',
        changes: {},
        edited: ['description', 'tags', 'price'],
        imagesAdded: 2,
        imagesRemoved: 1,
      },
    });
  });

  it('keeps a reorder inside an UPDATE when something else changed', () => {
    const result = buildProductUpdateActivity(
      product,
      { ...product, tags: ['256gb'], imgUrls: ['c.jpg', 'a.jpg', 'b.jpg'] },
      noNames,
    );
    expect(result?.action).toBe('UPDATE');
    expect(result?.meta).toMatchObject({
      edited: ['tags'],
      imagesReordered: true,
    });
  });
});

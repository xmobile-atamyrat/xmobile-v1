import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFind } = vi.hoisted(() => ({ mockFind: vi.fn() }));

vi.mock('@/lib/dbClient', () => ({
  default: { category: { findUnique: mockFind } },
}));

import {
  buildCategoryUpdateMeta,
  categoryLabel,
  categoryNameById,
} from '@/lib/categoryActivity';

describe('categoryLabel', () => {
  it('prefers the English name from the locale blob', () => {
    expect(categoryLabel('{"en":"Phones","ru":"Телефоны"}')).toBe('Phones');
  });

  it('falls back to the first non-empty locale value', () => {
    expect(categoryLabel('{"en":"","ru":"Телефоны"}')).toBe('Телефоны');
  });

  it('returns a plain string unchanged', () => {
    expect(categoryLabel('Phones')).toBe('Phones');
  });

  it('returns an empty string for missing input', () => {
    expect(categoryLabel(null)).toBe('');
    expect(categoryLabel(undefined)).toBe('');
  });
});

describe('categoryNameById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null without querying when there is no id', async () => {
    expect(await categoryNameById(null)).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns the readable name of the category', async () => {
    mockFind.mockResolvedValue({ name: '{"en":"Phones"}' });
    expect(await categoryNameById('c1')).toBe('Phones');
  });

  it('returns null when the lookup fails', async () => {
    mockFind.mockRejectedValue(new Error('db down'));
    expect(await categoryNameById('c1')).toBeNull();
  });
});

describe('buildCategoryUpdateMeta', () => {
  const base = {
    id: 'c1',
    name: '{"en":"Phones"}',
    popular: false,
    predecessorId: null as string | null,
    imgUrl: null as string | null,
  };

  it('returns null when nothing meaningful changed', () => {
    expect(
      buildCategoryUpdateMeta(base, { ...base }, { from: null, to: null }),
    ).toBeNull();
  });

  it('ignores a rename in a locale other than the shown label', () => {
    expect(
      buildCategoryUpdateMeta(
        base,
        { ...base, name: '{"en":"Phones","ru":"Телефоны"}' },
        { from: null, to: null },
      ),
    ).toBeNull();
  });

  it('records a rename, a popularity flip and a move with parent names', () => {
    expect(
      buildCategoryUpdateMeta(
        base,
        {
          ...base,
          name: '{"en":"Smartphones"}',
          popular: true,
          predecessorId: 'p2',
        },
        { from: null, to: 'Electronics' },
      ),
    ).toEqual({
      name: 'Smartphones',
      changes: {
        name: { from: 'Phones', to: 'Smartphones' },
        popular: { from: false, to: true },
        parent: { from: null, to: 'Electronics' },
      },
    });
  });

  it('flags an image change on its own', () => {
    expect(
      buildCategoryUpdateMeta(
        base,
        { ...base, imgUrl: '/media/x.webp' },
        { from: null, to: null },
      ),
    ).toEqual({ name: 'Phones', changes: {}, imageChanged: true });
  });
});

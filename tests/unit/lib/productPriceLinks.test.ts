import { describe, expect, test } from 'vitest';

import { planPriceLinks, referencedPriceIds } from '@/lib/productPriceLinks';

describe('referencedPriceIds', () => {
  test('collects the base price and every variant tag, deduped', () => {
    expect(
      referencedPriceIds('[base]', [
        '128gb [p1]{red}',
        '256gb [p2]',
        '512gb [p1]{blue}',
        'no price here{red}',
      ]).sort(),
    ).toEqual(['base', 'p1', 'p2']);
  });

  test('accepts a bare-id base price from older rows', () => {
    expect(referencedPriceIds('bare-id', [])).toEqual(['bare-id']);
  });

  test('returns nothing for an empty or missing base price', () => {
    expect(referencedPriceIds('', [])).toEqual([]);
    expect(referencedPriceIds(null, [])).toEqual([]);
  });
});

describe('planPriceLinks', () => {
  test('releases an owned price the product stopped referencing', () => {
    // The reported bug: a wrong pick, removed again, stayed owned.
    const plan = planPriceLinks({
      productId: 'A',
      previousIds: ['wrong'],
      nextIds: [],
      rows: [{ id: 'wrong', productId: 'A' }],
    });
    expect(plan).toEqual({ claim: [], release: ['wrong'], conflicts: [] });
  });

  test('claims a referenced price nobody owns', () => {
    const plan = planPriceLinks({
      productId: 'A',
      previousIds: [],
      nextIds: ['free'],
      rows: [{ id: 'free', productId: null }],
    });
    expect(plan).toEqual({ claim: ['free'], release: [], conflicts: [] });
  });

  test('refuses a newly referenced price another product owns', () => {
    const plan = planPriceLinks({
      productId: 'A',
      previousIds: [],
      nextIds: ['taken'],
      rows: [{ id: 'taken', productId: 'B' }],
    });
    expect(plan.conflicts).toEqual(['taken']);
  });

  test('leaves a price shared before ownership existed alone', () => {
    const plan = planPriceLinks({
      productId: 'A',
      previousIds: ['shared'],
      nextIds: ['shared'],
      rows: [{ id: 'shared', productId: 'B' }],
    });
    expect(plan).toEqual({ claim: [], release: [], conflicts: [] });
  });

  test('a product not created yet releases nothing', () => {
    const plan = planPriceLinks({
      productId: null,
      previousIds: [],
      nextIds: ['free'],
      rows: [
        { id: 'free', productId: null },
        { id: 'other', productId: null },
      ],
    });
    expect(plan).toEqual({ claim: ['free'], release: [], conflicts: [] });
  });

  test('keeps a price it still references and already owns', () => {
    const plan = planPriceLinks({
      productId: 'A',
      previousIds: ['mine'],
      nextIds: ['mine'],
      rows: [{ id: 'mine', productId: 'A' }],
    });
    expect(plan).toEqual({ claim: [], release: [], conflicts: [] });
  });
});

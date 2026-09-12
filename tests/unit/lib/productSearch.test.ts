import {
  PRODUCT_LISTING_PATHNAME,
  SEARCH_QUERY_KEY,
  productSearchPath,
  readSearchKeyword,
} from '@/pages/lib/productSearch';
import { describe, expect, it } from 'vitest';

describe('readSearchKeyword', () => {
  it('reads the term out of a query', () => {
    expect(readSearchKeyword({ [SEARCH_QUERY_KEY]: 'iphone' })).toBe('iphone');
  });

  it('returns an empty string when there is no term', () => {
    expect(readSearchKeyword({})).toBe('');
  });

  it('takes the first value when the param repeats', () => {
    // Next.js hands back an array for ?searchKeyword=a&searchKeyword=b.
    expect(readSearchKeyword({ [SEARCH_QUERY_KEY]: ['a', 'b'] })).toBe('a');
  });

  it('trims surrounding whitespace', () => {
    expect(readSearchKeyword({ [SEARCH_QUERY_KEY]: '  iphone  ' })).toBe(
      'iphone',
    );
  });

  it('treats a whitespace-only term as absent', () => {
    expect(readSearchKeyword({ [SEARCH_QUERY_KEY]: '   ' })).toBe('');
  });
});

describe('productSearchPath', () => {
  it('carries the term in the query string', () => {
    expect(productSearchPath('iphone')).toBe(
      `${PRODUCT_LISTING_PATHNAME}?${SEARCH_QUERY_KEY}=iphone`,
    );
  });

  it('omits the param entirely for an empty term', () => {
    expect(productSearchPath('')).toBe(PRODUCT_LISTING_PATHNAME);
    expect(productSearchPath('   ')).toBe(PRODUCT_LISTING_PATHNAME);
  });

  it('percent-encodes the term', () => {
    expect(productSearchPath('air pods&more')).toBe(
      `${PRODUCT_LISTING_PATHNAME}?${SEARCH_QUERY_KEY}=air%20pods%26more`,
    );
  });

  it('round-trips through readSearchKeyword', () => {
    const term = 'air pods';
    const query = Object.fromEntries(
      new URL(
        productSearchPath(term),
        'https://example.test',
      ).searchParams.entries(),
    );
    expect(readSearchKeyword(query)).toBe(term);
  });
});

// The bug this module exists to prevent: the list-restoration cache in
// listRestoration.ts is keyed by pathname + search. While the search term lived
// only in ProductContext, a search and an unfiltered browse both sat on
// "/product" and shared one cache entry, so returning to the listing in a
// different search state restored the other one's products -- and the restore
// guard then suppressed the refetch that would have corrected it.
describe('list-restoration key isolation', () => {
  it('gives a search and an unfiltered browse different keys', () => {
    expect(productSearchPath('iphone')).not.toBe(productSearchPath(''));
  });

  it('gives two different searches different keys', () => {
    expect(productSearchPath('iphone')).not.toBe(productSearchPath('samsung'));
  });
});

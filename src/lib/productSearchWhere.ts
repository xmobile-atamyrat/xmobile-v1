import { whereActiveCategory } from '@/lib/prismaActiveScope';
import { Prisma } from '@prisma/client';

const MAX_SEARCH_TERMS = 5;

// Product and category names are stored as multi-locale JSON. A word found in
// this skeleton (a locale key, a lone letter of one) matches every row.
const LOCALE_JSON_SKELETON = '{"ru":"","en":"","tk":"","tr":"","ch":""}';

const isWeakWord = (word: string) =>
  word.length < 2 || LOCALE_JSON_SKELETON.includes(word);

/**
 * Drops NUL and unpaired UTF-16 surrogates. Postgres rejects both in a text
 * parameter, so a keyword like "/a%00b" made the whole search request fail.
 * Iterates by code point (no lookbehind regex, which old iOS Safari lacks).
 */
function withoutUnstorableChars(value: string): string {
  return Array.from(value)
    .filter((char) => {
      if (char === '\u0000') return false;
      const code = char.charCodeAt(0);
      // A paired surrogate arrives as one 2-unit char; a lone one as 1 unit.
      return !(char.length === 1 && code >= 0xd800 && code <= 0xdfff);
    })
    .join('');
}

/**
 * Splits a query into terms. A weak word, like the "s" in "galaxy s", would
 * match nearly anything on its own, so it stays attached to its neighbour and
 * is searched as part of that phrase.
 */
export function productSearchTerms(keyword: string): string[] {
  const words = withoutUnstorableChars(keyword)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const terms: string[] = [];
  let leadingWeak: string[] = [];

  words.forEach((word) => {
    if (!isWeakWord(word)) {
      terms.push([...leadingWeak, word].join(' '));
      leadingWeak = [];
    } else if (terms.length > 0) {
      terms[terms.length - 1] += ` ${word}`;
    } else {
      leadingWeak.push(word);
    }
  });
  if (terms.length === 0 && leadingWeak.length > 0) {
    terms.push(leadingWeak.join(' '));
  }

  return [...new Set(terms)].slice(0, MAX_SEARCH_TERMS);
}

/**
 * Every term must match somewhere: the product name, its brand, or its
 * category (or that category's parent). A product whose name lacks the brand,
 * like "Galaxy Watch 6" under Samsung, is still found by "samsung watch".
 */
export function productSearchWhere(
  keyword: string,
): Prisma.ProductWhereInput[] {
  return productSearchTerms(keyword).map((term) => {
    const contains = { contains: term, mode: 'insensitive' } as const;
    return {
      OR: [
        { name: contains },
        { brand: { name: contains } },
        { categories: { ...whereActiveCategory, name: contains } },
        {
          categories: {
            ...whereActiveCategory,
            predecessorCategory: { ...whereActiveCategory, name: contains },
          },
        },
      ],
    };
  });
}

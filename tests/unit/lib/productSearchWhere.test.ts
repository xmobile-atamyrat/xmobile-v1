import {
  productSearchTerms,
  productSearchWhere,
} from '@/lib/productSearchWhere';
import { describe, expect, it } from 'vitest';

const fieldsFor = (term: string) => {
  const contains = { contains: term, mode: 'insensitive' };
  const active = { deletedAt: null as Date | null };
  return {
    OR: [
      { name: contains },
      { brand: { name: contains } },
      { categories: { ...active, name: contains } },
      {
        categories: {
          ...active,
          predecessorCategory: { ...active, name: contains },
        },
      },
    ],
  };
};

describe('productSearchWhere', () => {
  it('matches a single word against name, brand and active categories', () => {
    expect(productSearchWhere('Samsung')).toEqual([fieldsFor('samsung')]);
  });

  it('requires every word to match somewhere', () => {
    expect(productSearchWhere('samsung  watch')).toEqual([
      fieldsFor('samsung'),
      fieldsFor('watch'),
    ]);
  });

  it('returns nothing for blank input', () => {
    expect(productSearchWhere('   ')).toEqual([]);
  });
});

describe('productSearchTerms', () => {
  it('drops repeated words', () => {
    expect(productSearchTerms('pro Pro')).toEqual(['pro']);
  });

  it('caps the number of terms', () => {
    expect(productSearchTerms('aa bb cc dd ee ff gg')).toHaveLength(5);
  });

  it('keeps a single letter attached to the word before it', () => {
    expect(productSearchTerms('galaxy s')).toEqual(['galaxy s']);
    expect(productSearchTerms('redmi note 12 c')).toEqual([
      'redmi',
      'note',
      '12 c',
    ]);
  });

  it('keeps words that look like locale keys attached', () => {
    expect(productSearchTerms('iphone en')).toEqual(['iphone en']);
    expect(productSearchTerms('ru case')).toEqual(['ru case']);
  });

  it('searches weak words alone when there is nothing to attach them to', () => {
    expect(productSearchTerms('s')).toEqual(['s']);
    expect(productSearchTerms('s e')).toEqual(['s e']);
  });
});

describe('productSearchTerms: characters Postgres cannot store', () => {
  it('drops NUL characters', () => {
    expect(productSearchTerms('iph\u0000one')).toEqual(['iphone']);
  });

  it('drops lone surrogates but keeps paired ones (emoji)', () => {
    expect(productSearchTerms('phone\ud800')).toEqual(['phone']);
    expect(productSearchTerms('\udc00case')).toEqual(['case']);
    expect(productSearchTerms('phone 📱')).toEqual(['phone', '📱']);
  });

  it('yields no terms when nothing storable is left', () => {
    expect(productSearchTerms('\u0000\ud800')).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { META_DESC_MAX_LENGTH } from '@/pages/lib/constants';
import {
  generateOrganizationSchema,
  generateProductJsonLd,
  generateProductMetaDescription,
  generateProductTitle,
  pickJsonLdOffer,
} from '@/pages/lib/seo';

describe('generateProductTitle', () => {
  it('joins product, optional brand, and business name', () => {
    expect(generateProductTitle('Phone', 'Acme')).toContain('Phone');
    expect(generateProductTitle('Phone', 'Acme')).toContain('Acme');
    expect(generateProductTitle('Phone', 'Acme')).toContain('Xmobile');
  });

  it('shortens overly long product names with ellipsis', () => {
    const long = 'P'.repeat(80);
    const t = generateProductTitle(long, 'Brand');
    expect(t).toContain('...');
    expect(t.length).toBeLessThan(long.length + 30);
  });
});

describe('generateProductMetaDescription', () => {
  it('substitutes template tokens', () => {
    const d = generateProductMetaDescription(
      'Buy {product} for {price} at {businessName}',
      'Widget',
      '12',
    );
    expect(d).toContain('Widget');
    expect(d).toContain('12 TMT');
    expect(d).toContain('Xmobile');
  });

  it('truncates to meta description max length', () => {
    const filler = 'x'.repeat(META_DESC_MAX_LENGTH + 40);
    const d = generateProductMetaDescription(filler, 'P');
    expect(d.length).toBeLessThanOrEqual(META_DESC_MAX_LENGTH);
    expect(d.endsWith('...')).toBe(true);
  });
});

describe('generateProductJsonLd', () => {
  const baseParams = {
    productName: 'iPhone 15 Pro',
    productUrl: 'https://xmobile.com.tm/ru/product/iphone-15-pro',
    sku: 'product-id-1',
    price: '12000',
    imageUrls: ['https://xmobile.com.tm/media/product/good/img1.jpg'],
    brandName: 'Apple',
    description: 'Latest flagship smartphone',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a merchant-listing Offer for an in-stock product', () => {
    const schema = generateProductJsonLd(baseParams)!;

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Product');
    expect(schema.name).toBe('iPhone 15 Pro');
    expect(schema.sku).toBe('product-id-1');
    expect(schema.offers).toMatchObject({
      '@type': 'Offer',
      price: '12000',
      priceCurrency: 'TMT',
      priceValidUntil: '2027-01-09',
      url: 'https://xmobile.com.tm/ru/product/iphone-15-pro',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Xmobile' },
      shippingDetails: {
        shippingRate: { value: 40, currency: 'TMT' },
        shippingDestination: { addressCountry: 'TM' },
        deliveryTime: {
          handlingTime: { minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { minValue: 3, maxValue: 3, unitCode: 'DAY' },
        },
      },
    });
  });

  it('points the seller at the organization schema', () => {
    const schema = generateProductJsonLd(baseParams)!;

    expect(schema.offers.seller['@id']).toBe(
      generateOrganizationSchema()['@id'],
    );
  });

  it('sets availability to OutOfStock when isOutOfStock is true', () => {
    const schema = generateProductJsonLd({
      ...baseParams,
      isOutOfStock: true,
    })!;

    expect(schema.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it.each([undefined, null, '', '0', 'undefined'])(
    'returns no markup when the price is %j',
    (price) => {
      expect(generateProductJsonLd({ ...baseParams, price })).toBeNull();
    },
  );

  it('includes the category only when one is given', () => {
    expect(generateProductJsonLd(baseParams)!.category).toBeUndefined();
    expect(
      generateProductJsonLd({
        ...baseParams,
        category: 'Телефоны > Смартфоны',
      })!.category,
    ).toBe('Телефоны > Смартфоны');
  });
});

describe('pickJsonLdOffer', () => {
  it('uses the base price and product flag when there are no variants', () => {
    expect(
      pickJsonLdOffer({
        basePrice: '3230',
        productOutOfStock: false,
        variants: [],
      }),
    ).toEqual({ price: '3230', isOutOfStock: false });
  });

  it('opens on the first variant that can be bought', () => {
    expect(
      pickJsonLdOffer({
        basePrice: '3230',
        productOutOfStock: false,
        variants: [
          { priceTmt: '3230', isOutOfStock: true },
          { priceTmt: '3990', isOutOfStock: false },
        ],
      }),
    ).toEqual({ price: '3990', isOutOfStock: false });
  });

  it('falls back to the first variant when all are sold out', () => {
    expect(
      pickJsonLdOffer({
        basePrice: '3230',
        productOutOfStock: false,
        variants: [
          { priceTmt: '3230', isOutOfStock: true },
          { priceTmt: null, isOutOfStock: true },
        ],
      }),
    ).toEqual({ price: '3230', isOutOfStock: true });
  });

  it('lets the product flag win over an in-stock variant', () => {
    expect(
      pickJsonLdOffer({
        basePrice: '3230',
        productOutOfStock: true,
        variants: [{ priceTmt: '3230', isOutOfStock: false }],
      }),
    ).toEqual({ price: '3230', isOutOfStock: true });
  });
});

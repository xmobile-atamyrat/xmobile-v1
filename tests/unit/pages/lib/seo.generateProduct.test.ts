import { describe, expect, it } from 'vitest';

import { META_DESC_MAX_LENGTH } from '@/pages/lib/constants';
import {
  generateProductMetaDescription,
  generateProductTitle,
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

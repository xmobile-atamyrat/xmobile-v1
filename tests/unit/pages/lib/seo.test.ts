import { afterEach, describe, expect, it, vi } from 'vitest';

import { INDEXABLE_LOCALES } from '@/pages/lib/constants';

describe('getCanonicalUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the production base URL when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getCanonicalUrl } = await import('@/pages/lib/seo');
    expect(getCanonicalUrl('ru', 'product/1')).toBe(
      'https://xmobile.com.tm/ru/product/1',
    );
  });

  it('strips a leading slash from the path', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getCanonicalUrl } = await import('@/pages/lib/seo');
    expect(getCanonicalUrl('tk', '/category/x')).toBe(
      'https://xmobile.com.tm/tk/category/x',
    );
  });

  it('uses host and port in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_HOST', '127.0.0.1');
    vi.stubEnv('NEXT_PUBLIC_PORT', '3003');
    const { getCanonicalUrl } = await import('@/pages/lib/seo');
    expect(getCanonicalUrl('en', 'about')).toBe(
      'http://127.0.0.1:3003/en/about',
    );
  });

  it('canonicalizes ch locale to tk', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getCanonicalUrl } = await import('@/pages/lib/seo');
    expect(getCanonicalUrl('ch', 'product/1')).toBe(
      'https://xmobile.com.tm/tk/product/1',
    );
  });

  it('generates root path without trailing slash', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getCanonicalUrl } = await import('@/pages/lib/seo');
    expect(getCanonicalUrl('ru', '')).toBe('https://xmobile.com.tm/ru');
  });
});

describe('generateHreflangLinks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('emits one link per locale plus x-default', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { generateHreflangLinks } = await import('@/pages/lib/seo');
    const links = generateHreflangLinks('product/42', 'ru');

    expect(links).toHaveLength(INDEXABLE_LOCALES.length + 1);
    expect(links.some((l) => l.locale === 'x-default')).toBe(true);
    expect(links.find((l) => l.locale === 'ru')?.url).toBe(
      'https://xmobile.com.tm/ru/product/42',
    );
    expect(links.find((l) => l.locale === 'x-default')?.url).toBe(
      'https://xmobile.com.tm/ru/product/42',
    );
  });

  it('excludes ch from hreflang links', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { generateHreflangLinks } = await import('@/pages/lib/seo');
    const links = generateHreflangLinks('product/42', 'ru');
    expect(links.some((l) => l.locale === 'ch')).toBe(false);
  });

  it('generates breadcrumbs for ch locale pointing to tk master URLs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { generateBreadcrumbJsonLd } = await import('@/pages/lib/seo');
    const breadcrumbs = generateBreadcrumbJsonLd(
      [],
      undefined,
      'ch',
      'Bash sahypa',
    );

    expect(breadcrumbs.itemListElement[0].item).toBe(
      'https://xmobile.com.tm/tk',
    );
  });
});

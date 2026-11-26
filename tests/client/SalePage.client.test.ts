// @vitest-environment jsdom

import { getServerSideProps } from '@/pages/sale.page';
import { getServerSideProps as sitemapProps } from '@/pages/sitemap.xml.page';
import type { GetServerSidePropsContext } from 'next';
import { describe, expect, it, vi } from 'vitest';

// Only the server half runs here, and this pulls in the whole UI.
vi.mock('@/pages/components/ProductGridContent', () => ({ default: vi.fn() }));
vi.mock('@/lib/dbClient', () => ({
  default: {
    product: { findMany: async (): Promise<never[]> => [] },
    category: { findMany: async (): Promise<never[]> => [] },
  },
}));

async function seoFor(query: Record<string, string> = {}) {
  const result = await getServerSideProps({
    locale: 'en',
    query,
  } as unknown as GetServerSidePropsContext);
  return (result as { props: { seoData: Record<string, unknown> } }).props
    .seoData;
}

describe('sale page SEO', () => {
  it('is indexable, with its own title, canonical and hreflang', async () => {
    const seo = await seoFor();

    expect(seo.title).toContain('Deals on Smartphones');
    expect(seo.title).not.toContain('{businessName}');
    expect(seo.description).not.toContain('{businessName}');
    expect(seo.canonicalUrl).toMatch(/\/en\/sale$/);
    expect(seo.hreflangLinks).toContainEqual({
      locale: 'tk',
      url: expect.stringMatching(/\/tk\/sale$/),
    });
    expect(seo.noIndex).toBe(false);
  });

  it('keeps filtered variants out of the index', async () => {
    expect((await seoFor({ brandIds: 'b1' })).noIndex).toBe(true);
  });

  it('is in the sitemap for every indexable locale', async () => {
    const write = vi.fn();
    await sitemapProps({
      res: { setHeader: vi.fn(), write, end: vi.fn() },
    } as unknown as GetServerSidePropsContext);

    const xml = write.mock.calls[0][0] as string;
    ['ru', 'tk', 'en', 'tr'].forEach((locale) =>
      expect(xml).toContain(`/${locale}/sale</loc>`),
    );
  });
});

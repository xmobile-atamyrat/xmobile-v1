// @vitest-environment jsdom

import PromoBannerSection from '@/pages/components/PromoBannerSection';
import { StorefrontBanner } from '@/pages/lib/types';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

function makeBanner(
  overrides: Partial<StorefrontBanner> = {},
): StorefrontBanner {
  return {
    id: 'banner-1',
    imgUrl: '/images/banners/a.jpg',
    redirectUrl: null,
    ...overrides,
  };
}

describe('PromoBannerSection', () => {
  it('renders nothing when there are no banners', () => {
    const { container } = renderWithProviders(
      createElement(PromoBannerSection, { banners: [] }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single banner without a link when there is no redirect', () => {
    const { container } = renderWithProviders(
      createElement(PromoBannerSection, { banners: [makeBanner()] }),
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('wraps the single banner image in a link when a redirect URL is set', () => {
    const { container } = renderWithProviders(
      createElement(PromoBannerSection, {
        banners: [makeBanner({ redirectUrl: '/category/phones' })],
      }),
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/category/phones');
  });

  it('does not render a slider for a single banner', () => {
    const { container } = renderWithProviders(
      createElement(PromoBannerSection, { banners: [makeBanner()] }),
    );
    expect(container.querySelector('.slick-slider')).toBeNull();
  });

  it('renders each banner as a real (non-cloned) slide when there are multiple', () => {
    const banners = [
      makeBanner({ id: 'banner-1', redirectUrl: '/category/a' }),
      makeBanner({ id: 'banner-2', redirectUrl: '/category/b' }),
    ];
    const { container } = renderWithProviders(
      createElement(PromoBannerSection, { banners }),
    );

    const realSlides = container.querySelectorAll(
      '.slick-slide:not(.slick-cloned)',
    );
    expect(realSlides.length).toBe(banners.length);
    expect(realSlides[0]?.querySelector('a')?.getAttribute('href')).toBe(
      '/category/a',
    );
    expect(realSlides[1]?.querySelector('a')?.getAttribute('href')).toBe(
      '/category/b',
    );
  });
});

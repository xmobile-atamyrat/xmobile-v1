// @vitest-environment jsdom

import CustomAppBar from '@/pages/components/Appbar';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { replaceProductSearch } from '@/pages/lib/productSearch';
import { useUserContext } from '@/pages/lib/UserContext';
import { act, fireEvent, screen } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/CategoryContext', () => ({
  useCategoryContext: vi.fn(),
}));

vi.mock('@/pages/lib/ProductContext', () => ({
  useProductContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/components/CategoryMegaMenu', () => ({
  default: (): null => null,
}));

vi.mock('@/pages/lib/productSearch', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/pages/lib/productSearch')>();
  return {
    ...actual,
    replaceProductSearch: vi.fn(actual.replaceProductSearch),
  };
});

const setSearchKeyword = vi.fn();

function renderAt(url: string, contextKeyword?: string, pathname?: string) {
  mockRouter.setCurrentUrl(url);
  // The real router reports the route pattern; this mock, the resolved path.
  if (pathname != null) mockRouter.pathname = pathname;
  vi.mocked(useProductContext).mockReturnValue({
    setProducts: vi.fn(),
    searchKeyword: contextKeyword,
    setSearchKeyword,
  } as never);
  return renderWithProviders(createElement(CustomAppBar));
}

const field = () => screen.getByRole<HTMLInputElement>('textbox');

const type = (value: string) =>
  fireEvent.change(field(), { target: { value } });

const navigate = (url: string) =>
  act(async () => {
    await mockRouter.push(url);
  });

const waitForDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

describe('header search field', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockRouter.locale = 'en';
    vi.mocked(useCategoryContext).mockReturnValue({
      categories: [],
      setSelectedCategoryId: vi.fn(),
    } as never);
    vi.mocked(useUserContext).mockReturnValue({
      user: undefined,
      setUser: vi.fn(),
      accessToken: '',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('following the URL', () => {
    it('clears when home loses its term, as the logo does', async () => {
      renderAt('/?searchKeyword=iphone');
      expect(field().value).toBe('iphone');

      await navigate('/');

      expect(field().value).toBe('');
    });

    it('takes on a term that comes back to home, as Back does', async () => {
      renderAt('/');

      await navigate('/?searchKeyword=iphone');

      expect(field().value).toBe('iphone');
    });

    it('clears when a listing loses its term', async () => {
      renderAt('/product?searchKeyword=iphone');

      await navigate('/product');

      expect(field().value).toBe('');
    });

    it('does not write a term it took from the URL back to it', async () => {
      renderAt('/');

      await navigate('/?searchKeyword=iphone');
      await waitForDebounce();

      expect(replaceProductSearch).not.toHaveBeenCalled();
    });

    it('leaves the field alone on a page with no term of its own', async () => {
      renderAt('/cart', 'iphone');

      await navigate('/cart?searchKeyword=other');

      expect(field().value).toBe('iphone');
    });
  });

  describe('typing', () => {
    it('still sends the term to the URL on home', async () => {
      renderAt('/');

      type('iphone');
      await waitForDebounce();

      expect(mockRouter.query.searchKeyword).toBe('iphone');
    });

    // The URL holds the trimmed term. Echoing it back would eat the space
    // halfway through "iphone 15".
    it('keeps a trailing space after its own write comes back', async () => {
      renderAt('/');

      type('iphone ');
      await waitForDebounce();

      expect(mockRouter.query.searchKeyword).toBe('iphone');
      expect(field().value).toBe('iphone ');
    });
  });

  describe('a term left in context', () => {
    it('does not seed a listing whose URL has no term', () => {
      renderAt('/product', 'iphone');

      expect(field().value).toBe('');
    });

    it('does not seed a category listing either', () => {
      renderAt(
        '/product-category/phones',
        'iphone',
        '/product-category/[categorySlug]',
      );

      expect(field().value).toBe('');
    });

    it('still seeds a page with no term of its own', () => {
      renderAt('/product/some-phone', 'iphone');

      expect(field().value).toBe('iphone');
    });

    it('is dropped when home has no term', () => {
      renderAt('/', 'iphone');

      expect(setSearchKeyword).toHaveBeenCalledWith('');
    });

    // A context change during hydration crashes the next/dynamic boundaries
    // below this header, and a cold load has nothing to clear.
    it('is not touched on a cold load of home', () => {
      renderAt('/');

      expect(setSearchKeyword).not.toHaveBeenCalled();
    });

    it('is not touched on a cold load of a shared search', () => {
      renderAt('/?searchKeyword=iphone');

      expect(setSearchKeyword).not.toHaveBeenCalled();
    });
  });
});

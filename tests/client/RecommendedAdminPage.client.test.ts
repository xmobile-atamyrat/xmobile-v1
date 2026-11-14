// @vitest-environment jsdom

import RecommendedProductsAdminPage from '@/pages/admin/recommended.page';
import { fetchProducts } from '@/pages/lib/apis';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

vi.mock('@/pages/lib/fetch', () => ({
  useFetchWithCreds: vi.fn(),
}));

vi.mock('@/pages/lib/apis', () => ({
  fetchProducts: vi.fn(),
}));

vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

const item = (
  id: string,
  name: string,
  { isOutOfStock = false, imgUrl = `/media/${id}.webp` as string | null } = {},
) => ({
  id,
  slug: id,
  name: JSON.stringify({ en: name }),
  imgUrl,
  isOutOfStock,
});

const fetchWithCreds = vi.fn();

function setUp(initial = [item('p1', 'Phone'), item('p2', 'Tablet')]) {
  vi.mocked(useUserContext).mockReturnValue({
    user: { id: 'u1', grade: 'ADMIN' },
    accessToken: 'token',
    isLoading: false,
  } as never);
  fetchWithCreds.mockReset();
  fetchWithCreds.mockImplementation(
    async ({ method, body }: { method: string; body?: object }) => {
      if (method === 'GET') return { success: true, data: initial };
      const { productIds } = body as { productIds: string[] };
      const byId = new Map(
        [...initial, item('p3', 'Watch')].map((row) => [row.id, row]),
      );
      return {
        success: true,
        data: productIds.map((id) => byId.get(id)),
      };
    },
  );
  vi.mocked(useFetchWithCreds).mockReturnValue(fetchWithCreds as never);
}

const renderPage = () =>
  renderWithProviders(createElement(RecommendedProductsAdminPage), {
    locale: 'en',
  });

const rowNames = () =>
  screen
    .getAllByRole('button', { name: 'Remove' })
    .map(
      (button) =>
        within(button.closest('[draggable]') as HTMLElement).getAllByText(
          /Phone|Tablet|Watch/,
        )[0].textContent,
    );

const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('Recommended products admin page', () => {
  beforeEach(() => {
    vi.mocked(fetchProducts).mockReset();
  });

  it('lists the saved picks in order with Save disabled', async () => {
    setUp();
    renderPage();
    await screen.findByText('Tablet');
    expect(rowNames()).toEqual(['Phone', 'Tablet']);
    expect(screen.getByText('2/50')).toBeTruthy();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('flags picks the storefront hides', async () => {
    setUp([
      item('p1', 'Phone', { imgUrl: null }),
      item('p2', 'Tablet', { isOutOfStock: true }),
    ]);
    renderPage();
    await screen.findByText('Tablet');
    expect(
      screen.getAllByText('No image: hidden from the storefront'),
    ).toHaveLength(1);
    expect(
      screen.getAllByText('Out of stock: hidden on the home page'),
    ).toHaveLength(1);
  });

  it('saves a reordered list in its new order', async () => {
    setUp();
    renderPage();
    await screen.findByText('Tablet');

    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(rowNames()).toEqual(['Tablet', 'Phone']);
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(saveButton());
    await screen.findByText('Recommended products saved');
    expect(fetchWithCreds).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'PUT',
        path: '/api/product/recommended',
        body: { productIds: ['p2', 'p1'] },
      }),
    );
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a searched product and marks picks already in the list', async () => {
    setUp();
    vi.mocked(fetchProducts).mockResolvedValue([
      {
        id: 'p1',
        slug: 'p1',
        name: JSON.stringify({ en: 'Phone' }),
        imgUrls: [],
        outOfStockAt: null,
      },
      {
        id: 'p3',
        slug: 'p3',
        name: JSON.stringify({ en: 'Watch' }),
        imgUrls: [],
        outOfStockAt: new Date(),
      },
    ] as never);
    renderPage();
    await screen.findByText('Tablet');

    fireEvent.change(screen.getByPlaceholderText('Search products to add'), {
      target: { value: 'wa' },
    });
    await screen.findByText('Watch');
    expect(fetchProducts).toHaveBeenCalledWith({
      searchKeyword: 'wa',
      staffToken: 'token',
    });
    expect(
      (screen.getByRole('button', { name: 'Added' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(rowNames()).toEqual(['Phone', 'Tablet', 'Watch']);
    expect(
      screen.getByText('Out of stock: hidden on the home page'),
    ).toBeTruthy();
  });

  it('keeps unsaved edits when the access token is silently refreshed', async () => {
    setUp();
    const { rerender } = renderPage();
    await screen.findByText('Tablet');
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    expect(rowNames()).toEqual(['Tablet', 'Phone']);

    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'u1', grade: 'ADMIN' },
      accessToken: 'refreshed-token',
      isLoading: false,
    } as never);
    rerender(createElement(RecommendedProductsAdminPage));

    expect(rowNames()).toEqual(['Tablet', 'Phone']);
    expect(
      fetchWithCreds.mock.calls.filter(([args]) => args.method === 'GET'),
    ).toHaveLength(1);

    // The newer token is still the one a save sends.
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(fetchWithCreds).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'PUT',
          accessToken: 'refreshed-token',
        }),
      ),
    );
  });

  it('removes a pick, and Cancel brings the saved list back', async () => {
    setUp();
    renderPage();
    await screen.findByText('Tablet');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(rowNames()).toEqual(['Tablet']);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rowNames()).toEqual(['Phone', 'Tablet']);
  });

  it('reloads the list when a pick was deleted meanwhile', async () => {
    setUp();
    renderPage();
    await screen.findByText('Tablet');
    fetchWithCreds.mockImplementationOnce(async () => ({
      success: false,
      message: 'productNotFound',
    }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    fireEvent.click(saveButton());

    await screen.findByText(
      'A product in the list was deleted. The list was reloaded.',
    );
    await waitFor(() =>
      expect(
        fetchWithCreds.mock.calls.filter(([args]) => args.method === 'GET'),
      ).toHaveLength(2),
    );
  });
});

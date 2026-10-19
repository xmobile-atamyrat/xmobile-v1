// @vitest-environment jsdom

import AddToCart from '@/pages/components/AddToCart';
import { fetchWithoutCreds } from '@/pages/lib/fetch';
import { fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: () => ({ user: undefined as unknown, accessToken: '' }),
}));

vi.mock('@/pages/lib/CartContext', () => ({
  useCartContext: () => ({ setCartCount: vi.fn() }),
}));

vi.mock('@/pages/lib/fetch', () => ({
  fetchWithoutCreds: vi.fn(),
  useFetchWithCreds: () => vi.fn(),
}));

// Run the debounced PUT straight away so each change can be asserted on.
vi.mock('@/pages/product/utils', () => ({
  debounce:
    (fn: (...args: unknown[]) => void) =>
    (...args: unknown[]) =>
      fn(...args),
}));

function renderCartLine(quantity: number) {
  const setTotalPrice = vi.fn();
  const { container } = renderWithProviders(
    createElement(AddToCart, {
      cartAction: 'delete',
      cartItemId: 'c1',
      productId: 'p1',
      price: '10',
      quantity,
      setTotalPrice,
    }),
  );
  const input = container.querySelector(
    'input[name="quantity"]',
  ) as HTMLInputElement;
  return { input, setTotalPrice };
}

const putBodies = () =>
  vi
    .mocked(fetchWithoutCreds)
    .mock.calls.filter(([, method]) => method === 'PUT')
    .map(([, , body]) => body);

describe('AddToCart quantity input', () => {
  beforeEach(() => {
    vi.mocked(fetchWithoutCreds).mockReset();
    vi.mocked(fetchWithoutCreds).mockResolvedValue({ success: true });
  });

  it('restores the previous quantity when the field is left blank', () => {
    const { input } = renderCartLine(4);

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    fireEvent.blur(input);

    expect(input.value).toBe('4');
    expect(putBodies()).toEqual([]);
  });

  it('ignores input that is not a whole number', () => {
    const { input } = renderCartLine(2);

    ['1.5', '2-3', '-1', '1,000'].forEach((value) => {
      fireEvent.change(input, { target: { value } });
      expect(input.value).toBe('2');
    });
    expect(putBodies()).toEqual([]);
  });

  it('caps the quantity at 999', () => {
    const { input } = renderCartLine(1);

    fireEvent.change(input, { target: { value: '5000' } });

    expect(input.value).toBe('999');
    expect(putBodies()).toEqual([{ id: 'c1', quantity: 999 }]);
  });
});

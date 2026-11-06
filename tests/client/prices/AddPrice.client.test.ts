// @vitest-environment jsdom

import AddPrice from '@/pages/product/components/AddPrice';
import type { DollarRate } from '@prisma/client';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

const rates = [
  { id: 1, name: 'Manat', rate: 20, isDefault: true },
  { id: 2, name: 'Bazar', rate: 25, isDefault: false },
] as DollarRate[];

const handleCreate = vi.fn();

const dialog = (props: {
  rates: DollarRate[];
  defaultRateId: number | null;
  defaultCategoryId?: string | null;
}) =>
  createElement(AddPrice, {
    handleClose: vi.fn(),
    handleCreate,
    categoryOptions: [{ id: 'phones', name: 'Phones', depth: 0 }],
    defaultCategoryId: null,
    ...props,
  });

const manatValue = () =>
  (screen.getByPlaceholderText('Price in manat') as HTMLInputElement).value;

const rateSelect = () =>
  within(
    screen.getByText('Rate', { selector: 'label' })
      .parentElement as HTMLElement,
  ).getByRole('combobox');

const pickRate = async (name: string) => {
  const user = userEvent.setup();
  await user.click(rateSelect());
  await user.click(within(screen.getByRole('listbox')).getByText(name));
};

describe('AddPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleCreate.mockResolvedValue(true);
  });

  it('starts on the rate it is given', () => {
    renderWithProviders(dialog({ rates, defaultRateId: 2 }));

    expect(rateSelect().textContent).toBe('Bazar (25)');
  });

  it('converts at the selected rate and creates the price on it', async () => {
    const user = userEvent.setup();
    renderWithProviders(dialog({ rates, defaultRateId: 1 }));

    await user.type(screen.getByPlaceholderText('Product Name'), 'iPhone');
    await user.type(screen.getByPlaceholderText('Price in dollars'), '10');
    expect(manatValue()).toBe('200');

    await pickRate('Bazar (25)');
    expect(manatValue()).toBe('250');

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(handleCreate).toHaveBeenCalledWith('iPhone', '10', '250', null, 2);
  });

  it('leaves the empty amounts alone when the rate changes first', async () => {
    renderWithProviders(dialog({ rates, defaultRateId: 1 }));

    await pickRate('Bazar (25)');

    expect(manatValue()).toBe('');
  });

  it('starts on the category it is given and can still clear it', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      dialog({ rates, defaultRateId: 1, defaultCategoryId: 'phones' }),
    );
    const categorySelect = within(
      screen.getByText('Category', { selector: 'label' })
        .parentElement as HTMLElement,
    ).getByRole('combobox');
    expect(categorySelect.textContent).toBe('Phones');

    await user.click(categorySelect);
    await user.click(
      within(screen.getByRole('listbox')).getByText('No category'),
    );
    await user.type(screen.getByPlaceholderText('Product Name'), 'iPhone');
    await user.type(screen.getByPlaceholderText('Price in dollars'), '10');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(handleCreate).toHaveBeenCalledWith('iPhone', '10', '200', null, 1);
  });

  it('picks up the rate when rates finish loading after it opens', () => {
    const { rerender } = renderWithProviders(
      dialog({ rates: [], defaultRateId: null }),
    );

    rerender(dialog({ rates, defaultRateId: 1 }));

    expect(rateSelect().textContent).toBe('Manat (20)');
  });
});

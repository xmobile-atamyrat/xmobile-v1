// @vitest-environment jsdom

import { usePlatform } from '@/pages/lib/PlatformContext';
import RateCard from '@/pages/procurement/components/RateCard';
import {
  ProcurementContextValue,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { CURRENCY, DollarRate } from '@prisma/client';
import { fireEvent, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: vi.fn(),
}));

vi.mock('@/pages/lib/PlatformContext', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/pages/lib/PlatformContext')>();
  return { ...actual, usePlatform: vi.fn(() => 'web') };
});

const rate = (currency: CURRENCY, value: number, name: string) =>
  ({ id: 1, currency, rate: value, name, isDefault: false }) as DollarRate;

const rates = [
  rate(CURRENCY.TMT, 19.6, 'Manat'),
  rate(CURRENCY.AED, 3.67, 'Dirham'),
];

let ctx: Partial<ProcurementContextValue>;
let rerenderCard: () => void;

function setup(currency: CURRENCY, opts: { rates?: DollarRate[] } = {}) {
  const list = opts.rates ?? rates;
  ctx = {
    selectedHistory: { id: 'o1', name: 'Week 45', currency } as never,
    rates: list,
    orderCurrencyRate: list.find((r) => r.currency === currency),
    // Mirrors the provider: optimistic update of the order's rate.
    changeRate: vi.fn(async (value: number | undefined) => {
      ctx.orderCurrencyRate = { ...ctx.orderCurrencyRate!, rate: value! };
      rerenderCard();
    }),
    changeCurrency: vi.fn(async () => undefined),
  };
  vi.mocked(useProcurement).mockImplementation(
    () => ctx as ProcurementContextValue,
  );
  const { rerender } = renderWithProviders(createElement(RateCard));
  rerenderCard = () => rerender(createElement(RateCard));
}

const typeInto = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('RateCard', () => {
  beforeEach(() => {
    vi.mocked(usePlatform).mockReturnValue('web');
  });

  it('never saves while typing; saves once on blur, parsing a comma', () => {
    setup(CURRENCY.AED);
    const input = screen.getByRole('textbox', { name: 'Rate' });
    expect(input).toHaveValue('3.67');

    typeInto(input, '3');
    typeInto(input, '3,');
    typeInto(input, '3,7');
    typeInto(input, '3,75');
    expect(ctx.changeRate).not.toHaveBeenCalled();
    expect(
      screen.getByText('Saves when you leave the field or press Enter'),
    ).toBeTruthy();

    fireEvent.blur(input);
    expect(ctx.changeRate).toHaveBeenCalledTimes(1);
    expect(ctx.changeRate).toHaveBeenCalledWith(3.75);
    // The typed text survives the saved value coming back.
    expect(input).toHaveValue('3,75');
  });

  it('keeps a trailing separator while typing', () => {
    setup(CURRENCY.AED);
    const input = screen.getByRole('textbox', { name: 'Rate' });

    typeInto(input, '4.');
    expect(input).toHaveValue('4.');
    fireEvent.blur(input);
    expect(ctx.changeRate).toHaveBeenCalledWith(4);
    expect(input).toHaveValue('4.');
  });

  it('Enter commits the value', () => {
    setup(CURRENCY.AED);
    const input = screen.getByRole('textbox', { name: 'Rate' });
    input.focus();
    typeInto(input, '3.8');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(ctx.changeRate).toHaveBeenCalledWith(3.8);
  });

  it('ignores letters, flags zero and restores the stored rate on blur', () => {
    setup(CURRENCY.AED);
    const input = screen.getByRole('textbox', { name: 'Rate' });

    typeInto(input, '3a');
    expect(input).toHaveValue('3.67');

    typeInto(input, '0');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a number greater than 0',
    );
    fireEvent.blur(input);

    expect(ctx.changeRate).not.toHaveBeenCalled();
    expect(input).toHaveValue('3.67');
  });

  it('does not save an unchanged rate', () => {
    setup(CURRENCY.AED);
    const input = screen.getByRole('textbox', { name: 'Rate' });
    typeInto(input, '3,67');
    fireEvent.blur(input);
    expect(ctx.changeRate).not.toHaveBeenCalled();
  });

  it('shows a USD order as read-only even when USD has no rate row', () => {
    setup(CURRENCY.USD);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByTestId('procurement-rate-readonly')).toHaveTextContent(
      '1',
    );
    expect(
      screen.getByText('Prices are in US dollars, no conversion needed'),
    ).toBeTruthy();
  });

  it('handles a currency without a rate and can still switch away', () => {
    vi.mocked(usePlatform).mockReturnValue('mobile');
    setup(CURRENCY.CNY);
    expect(screen.getByTestId('procurement-rate-readonly')).toHaveTextContent(
      '—',
    );
    expect(screen.getByText('No rate is set for this currency')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Order currency: CNY' }),
    );
    const radios = screen.getAllByRole('radio');
    // USD is always offered, then the rates that exist.
    expect(radios.map((r) => r.textContent)).toEqual([
      expect.stringContaining('USD'),
      expect.stringContaining('TMT'),
      expect.stringContaining('AED'),
    ]);
    fireEvent.click(screen.getByRole('radio', { name: /Manat/ }));
    expect(ctx.changeCurrency).toHaveBeenCalledWith(CURRENCY.TMT);
  });

  it('warns that the TMT rate is the store-wide one', () => {
    setup(CURRENCY.TMT);
    expect(screen.getByRole('textbox', { name: 'Rate' })).toHaveValue('19.6');
    expect(
      screen.getByText(
        'Store-wide rate: changing it recalculates prices on the site',
      ),
    ).toBeTruthy();
  });
});

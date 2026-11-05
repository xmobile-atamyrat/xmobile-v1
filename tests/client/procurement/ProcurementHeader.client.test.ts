// @vitest-environment jsdom

import { usePlatform } from '@/pages/lib/PlatformContext';
import ProcurementHeader from '@/pages/procurement/components/ProcurementHeader';
import {
  ProcurementContextValue,
  useProcurement,
} from '@/pages/procurement/lib/ProcurementContext';
import { fireEvent, screen } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('@/pages/procurement/lib/ProcurementContext', () => ({
  useProcurement: vi.fn(),
}));

vi.mock('@/pages/lib/PlatformContext', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/pages/lib/PlatformContext')>();
  return { ...actual, usePlatform: vi.fn(() => 'mobile') };
});

const setOrdersSheetOpen = vi.fn();
const setNewOrderDialogOpen = vi.fn();

function setup(overrides: Partial<ProcurementContextValue> = {}) {
  vi.mocked(useProcurement).mockReturnValue({
    selectedHistory: { id: 'o1', name: 'Week 45' },
    historyList: [{ id: 'o1' }],
    initialLoading: false,
    setOrdersSheetOpen,
    setNewOrderDialogOpen,
    ...overrides,
  } as unknown as ProcurementContextValue);
  renderWithProviders(createElement(ProcurementHeader));
}

describe('ProcurementHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePlatform).mockReturnValue('mobile');
  });

  it('opens the orders sheet from the active order chip (mobile)', () => {
    setup();
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch order: Week 45' }),
    );
    expect(setOrdersSheetOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'New Order' }));
    expect(setNewOrderDialogOpen).toHaveBeenCalledWith(true);
  });

  it('goes back to the profile', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.asPath).toBe('/user');
  });

  it('hides the order switcher when there are no orders', () => {
    setup({ selectedHistory: undefined, historyList: [] });
    expect(screen.queryByRole('button', { name: /Switch order/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Order' })).toBeTruthy();
  });

  it('shows switcher and new-order button on desktop', () => {
    vi.mocked(usePlatform).mockReturnValue('web');
    setup();
    expect(screen.getByRole('heading', { name: 'Procurement' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Switch order: Week 45' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /New Order/ })).toBeTruthy();
  });
});

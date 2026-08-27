// @vitest-environment jsdom

import OutOfStockDialog from '@/pages/cart/components/OutOfStockDialog';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const items = [
  { id: 'ci-1', name: '{"en":"Galaxy S24","tk":"Galaxy S24"}' },
  { id: 'ci-2', name: '{"en":"AirPods Pro","tk":"AirPods Pro"}' },
];

describe('OutOfStockDialog', () => {
  it('lists the name of every out-of-stock product', () => {
    renderWithProviders(
      createElement(OutOfStockDialog, {
        items,
        onClose: vi.fn(),
        onRemove: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(screen.getByText('Galaxy S24')).toBeInTheDocument();
    expect(screen.getByText('AirPods Pro')).toBeInTheDocument();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      createElement(OutOfStockDialog, { items, onClose, onRemove }),
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('calls onRemove when the remove action is confirmed', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      createElement(OutOfStockDialog, {
        items,
        onClose: vi.fn(),
        onRemove,
      }),
    );

    await user.click(screen.getByRole('button', { name: /remove them/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('omits the back-to-cart action when no handler is given', () => {
    renderWithProviders(
      createElement(OutOfStockDialog, {
        items,
        onClose: vi.fn(),
        onRemove: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(
      screen.queryByRole('button', { name: /back to cart/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onBackToCart when the back-to-cart action is pressed', async () => {
    const user = userEvent.setup();
    const onBackToCart = vi.fn();

    renderWithProviders(
      createElement(OutOfStockDialog, {
        items,
        onClose: vi.fn(),
        onRemove: vi.fn().mockResolvedValue(undefined),
        onBackToCart,
      }),
    );

    await user.click(screen.getByRole('button', { name: /back to cart/i }));

    expect(onBackToCart).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom

import HomeBrandChips from '@/pages/components/HomeBrandChips';
import { fireEvent, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const brands = [
  { id: 'b1', name: 'Samsung' },
  { id: 'b2', name: 'Apple' },
];

const renderChips = (selectedId: string | null, onSelect = vi.fn()) => {
  renderWithProviders(
    createElement(HomeBrandChips, { brands, selectedId, onSelect }),
    { locale: 'en' },
  );
  return onSelect;
};

describe('HomeBrandChips', () => {
  it('selects the tapped brand', () => {
    const onSelect = renderChips(null);

    fireEvent.click(screen.getByRole('button', { name: 'Samsung' }));

    expect(onSelect).toHaveBeenCalledWith('b1');
    expect(screen.getByText('Choose a brand')).toBeInTheDocument();
  });

  it('marks the selected brand and deselects it on a second tap', () => {
    const onSelect = renderChips('b1');

    const chip = screen.getByRole('button', { name: 'Samsung' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Apple' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(chip);

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders nothing without brands', () => {
    const { container } = renderWithProviders(
      createElement(HomeBrandChips, {
        brands: [],
        selectedId: null,
        onSelect: vi.fn(),
      }),
      { locale: 'en' },
    );

    expect(container).toBeEmptyDOMElement();
  });
});

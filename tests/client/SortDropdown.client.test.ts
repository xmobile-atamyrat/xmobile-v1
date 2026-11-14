// @vitest-environment jsdom

import SortDropdown from '@/pages/components/SortDropdown';
import { SORT_OPTIONS } from '@/pages/lib/constants';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('SortDropdown (chips)', () => {
  it('notifies parent when a different sort chip is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithProviders(
      createElement(SortDropdown, {
        value: SORT_OPTIONS.PRICE_ASC,
        onChange,
        variant: 'chips',
      }),
    );

    await user.click(screen.getByText('Price High-to-Low'));

    expect(onChange).toHaveBeenCalledWith(SORT_OPTIONS.PRICE_DESC);
  });

  it('offers the recommended order only when asked to', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(
      createElement(SortDropdown, {
        value: SORT_OPTIONS.NEWEST,
        onChange,
        variant: 'chips',
      }),
    );
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();

    rerender(
      createElement(SortDropdown, {
        value: SORT_OPTIONS.NEWEST,
        onChange,
        variant: 'chips',
        showRecommended: true,
      }),
    );
    await user.click(screen.getByText('Recommended'));

    expect(onChange).toHaveBeenCalledWith(SORT_OPTIONS.RECOMMENDED);
  });
});

describe('SortDropdown (dropdown)', () => {
  it('names the recommended order when the listing is sorted by it', () => {
    renderWithProviders(
      createElement(SortDropdown, {
        value: SORT_OPTIONS.RECOMMENDED,
        onChange: vi.fn(),
        showRecommended: true,
      }),
    );

    expect(screen.getByText(/Recommended$/)).toBeInTheDocument();
  });
});

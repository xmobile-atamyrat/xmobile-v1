// @vitest-environment jsdom

import { SearchBar } from '@/pages/components/Appbar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

function ControlledSearchBar(props: {
  handleSearch?: (keyword: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  return createElement(SearchBar, {
    searchPlaceholder: 'Search',
    searchKeyword,
    setSearchKeyword,
    handleSearch: props.handleSearch,
    onSubmit: props.onSubmit,
    submitLabel: props.submitLabel,
  });
}

describe('SearchBar', () => {
  it('updates keyword state and forwards to handleSearch while typing', async () => {
    const user = userEvent.setup();
    const handleSearch = vi.fn();

    renderWithProviders(createElement(ControlledSearchBar, { handleSearch }));

    const input = screen.getByPlaceholderText('Search...');
    await user.type(input, 'ab');

    expect(handleSearch).toHaveBeenLastCalledWith('ab');
  });

  it('calls onSubmit on button click and on Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      createElement(ControlledSearchBar, { onSubmit, submitLabel: 'Find' }),
    );

    await user.click(screen.getByRole('button', { name: 'Find' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.type(screen.getByPlaceholderText('Search...'), 'x{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('renders no submit button without onSubmit', () => {
    renderWithProviders(
      createElement(ControlledSearchBar, { submitLabel: 'Find' }),
    );

    expect(screen.queryByRole('button', { name: 'Find' })).toBeNull();
  });
});

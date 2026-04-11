// @vitest-environment jsdom

import { SearchBar } from '@/pages/components/Appbar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

function ControlledSearchBar(props: {
  handleSearch?: (keyword: string) => void;
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  return createElement(SearchBar, {
    searchPlaceholder: 'Search',
    searchKeyword,
    setSearchKeyword,
    handleSearch: props.handleSearch,
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
});

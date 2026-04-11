// @vitest-environment jsdom

import Loader from '@/pages/components/Loader';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('Loader', () => {
  it('renders the branded loading image', () => {
    renderWithProviders(createElement(Loader));

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/logo/xmobile-original-logo.jpeg');
  });
});

// @vitest-environment jsdom

import TikTokIcon from '@/pages/components/TikTokIcon';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('TikTokIcon', () => {
  it('renders an svg root', () => {
    const { container } = renderWithProviders(
      createElement(TikTokIcon, { color: '#112233' }),
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('focusable', 'false');
  });
});

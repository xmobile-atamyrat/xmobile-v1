// @vitest-environment jsdom

import Loader from '@/pages/components/Loader';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('Loader', () => {
  it('stays hidden below the md breakpoint', () => {
    const { container } = renderWithProviders(createElement(Loader));

    expect(getComputedStyle(container.firstElementChild!).display).toBe('none');
  });

  it('shows the logo only from the md breakpoint up', () => {
    renderWithProviders(createElement(Loader));

    const css = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('');
    expect(css).toMatch(
      /@media \(min-width:900px\)\{[^}]*display:block;[^}]*url\('\/logo\/xmobile-original-logo\.jpeg'\)/,
    );
  });
});

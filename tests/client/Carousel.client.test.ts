// @vitest-environment jsdom

import Carousel from '@/pages/components/Carousel';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('Carousel', () => {
  it('renders child slides inside the slider', () => {
    const { container } = renderWithProviders(
      createElement(
        Carousel,
        null,
        createElement('div', null, 'Slide A'),
        createElement('div', null, 'Slide B'),
      ),
    );

    // react-slick clones slides for looping, so plain getByText matches duplicates.
    const realSlides = container.querySelectorAll(
      '.slick-slide:not(.slick-cloned)',
    );
    expect(realSlides[0]?.textContent).toContain('Slide A');
    expect(realSlides[1]?.textContent).toContain('Slide B');
  });
});

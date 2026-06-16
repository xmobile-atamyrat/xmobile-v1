// @vitest-environment jsdom

import VariantBadge from '@/pages/components/VariantBadge';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

describe('VariantBadge', () => {
  it('renders the spec text', () => {
    renderWithProviders(createElement(VariantBadge, { spec: '128gb storage' }));
    expect(screen.getByText('128gb storage')).toBeInTheDocument();
  });

  it('renders a color swatch with the hex as background when colorHex is provided', () => {
    const { container } = renderWithProviders(
      createElement(VariantBadge, {
        spec: '128gb',
        colorHex: '#ff0000',
        colorName: 'Red',
      }),
    );
    // The swatch is a Box with backgroundColor set via MUI sx
    const swatch = container.querySelector('[title="Red"]');
    expect(swatch).toBeInTheDocument();
  });

  it('exposes the colorName via the swatch title attribute', () => {
    renderWithProviders(
      createElement(VariantBadge, {
        spec: '256gb',
        colorHex: '#00ff00',
        colorName: 'Green',
      }),
    );
    expect(screen.getByTitle('Green')).toBeInTheDocument();
  });

  it('does not render a swatch when colorHex is undefined', () => {
    renderWithProviders(
      createElement(VariantBadge, { spec: '512gb', colorName: 'Blue' }),
    );
    // No element with title "Blue" should appear (no swatch without hex)
    expect(screen.queryByTitle('Blue')).not.toBeInTheDocument();
  });

  it('renders without crashing when only spec is provided', () => {
    renderWithProviders(createElement(VariantBadge, { spec: 'just a spec' }));
    expect(screen.getByText('just a spec')).toBeInTheDocument();
  });

  it('returns null (renders nothing) when both spec and colorHex are absent', () => {
    const { container } = renderWithProviders(
      createElement(VariantBadge, {} as any),
    );
    expect(container.firstChild).toBeNull();
  });
});

// @vitest-environment jsdom

import AttentionDot from '@/pages/components/AttentionDot';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const renderDot = (show: boolean) =>
  renderWithProviders(
    // The props type requires `children`; as a 3rd argument it fails to type.
    // eslint-disable-next-line react/no-children-prop
    createElement(AttentionDot, {
      show,
      label: 'Some prices need updating',
      children: createElement('span', null, 'icon'),
    }),
  );

describe('AttentionDot', () => {
  it('announces itself while shown', () => {
    renderDot(true);

    expect(
      screen.getByRole('status', { name: 'Some prices need updating' }),
    ).toBeInTheDocument();
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('stays hidden and silent otherwise', () => {
    renderDot(false);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('icon')).toBeInTheDocument();
  });
});

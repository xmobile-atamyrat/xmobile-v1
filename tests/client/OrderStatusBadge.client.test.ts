// @vitest-environment jsdom

import AdminOrderStatusBadge from '@/pages/orders/admin/components/OrderStatusBadge';
import UserOrderStatusBadge from '@/pages/orders/components/OrderStatusBadge';
import { UserOrderStatus } from '@prisma/client';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const badges = [
  ['user', UserOrderStatusBadge],
  ['admin', AdminOrderStatusBadge],
] as const;

describe.each(badges)('%s OrderStatusBadge', (_name, Badge) => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('labels ON_THE_WAY with its translation', () => {
    renderWithProviders(
      createElement(Badge, { status: UserOrderStatus.ON_THE_WAY }),
    );
    expect(screen.getByText('On the Way')).toBeInTheDocument();
  });

  it.each(Object.values(UserOrderStatus))(
    'renders %s without a missing-message error',
    (status) => {
      // next-intl reports a missing key through console.error and renders the
      // key path instead of a label.
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = renderWithProviders(
        createElement(Badge, { status }),
      );
      expect(error).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain(status);
      expect(container.textContent?.trim()).not.toBe('');
    },
  );
});

// @vitest-environment jsdom

import NotificationBadge from '@/pages/components/NotificationBadge';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/NotificationContext', () => ({
  useNotificationContext: vi.fn(),
}));

describe('NotificationBadge', () => {
  const onClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [],
      unreadCount: 3,
      isLoading: false,
      hasMore: false,
      loadNotifications: vi.fn(),
      markAsRead: vi.fn(),
      refreshUnreadCount: vi.fn(),
      markSessionAsRead: vi.fn(),
    });
  });

  it('invokes onClick when the bell control is activated', async () => {
    const user = userEvent.setup();
    renderWithProviders(createElement(NotificationBadge, { onClick }));

    await user.click(screen.getByRole('button', { name: /notifications/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows 99+ when unread count exceeds 99', () => {
    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [],
      unreadCount: 120,
      isLoading: false,
      hasMore: false,
      loadNotifications: vi.fn(),
      markAsRead: vi.fn(),
      refreshUnreadCount: vi.fn(),
      markSessionAsRead: vi.fn(),
    });

    renderWithProviders(createElement(NotificationBadge, { onClick }));

    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});

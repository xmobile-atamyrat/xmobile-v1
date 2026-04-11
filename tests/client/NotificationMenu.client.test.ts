// @vitest-environment jsdom

import NotificationMenu from '@/pages/components/NotificationMenu';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { useUserContext } from '@/pages/lib/UserContext';
import type { InAppNotification } from '@/pages/lib/types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockRouter from 'next-router-mock';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/NotificationContext', () => ({
  useNotificationContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

function makeNotification(
  overrides: Partial<InAppNotification> = {},
): InAppNotification {
  const now = new Date().toISOString();
  return {
    id: 'n1',
    userId: 'u1',
    type: 'CHAT_MESSAGE',
    content: 'Hello from chat',
    title: 'Chat',
    isRead: false,
    createdAt: now,
    updatedAt: now,
    sessionId: 'sess-1',
    ...overrides,
  };
}

describe('NotificationMenu', () => {
  const onClose = vi.fn();
  const markAsRead = vi.fn().mockResolvedValue(undefined);
  const loadNotifications = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockRouter.setCurrentUrl('/');
    mockRouter.locale = 'tk';
    vi.clearAllMocks();

    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'u1' } as never,
      setUser: vi.fn(),
      accessToken: 'token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });

    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      hasMore: false,
      loadNotifications,
      markAsRead,
      refreshUnreadCount: vi.fn(),
      markSessionAsRead: vi.fn(),
    });
  });

  it('shows empty state when there are no notifications', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);

    renderWithProviders(
      createElement(NotificationMenu, {
        anchorEl: anchor,
        open: true,
        onClose,
      }),
    );

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('marks a single unread item read and navigates to chat when a chat notification is opened', async () => {
    const user = userEvent.setup();
    const notification = makeNotification();
    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [notification],
      unreadCount: 1,
      isLoading: false,
      hasMore: false,
      loadNotifications,
      markAsRead,
      refreshUnreadCount: vi.fn(),
      markSessionAsRead: vi.fn(),
    });

    const anchor = document.createElement('div');
    document.body.appendChild(anchor);

    renderWithProviders(
      createElement(NotificationMenu, {
        anchorEl: anchor,
        open: true,
        onClose,
      }),
    );

    await user.click(screen.getByText('Hello from chat'));

    expect(markAsRead).toHaveBeenCalledWith([notification.id]);
    expect(onClose).toHaveBeenCalled();
    expect(mockRouter.asPath).toBe('/chat?sessionId=sess-1');
  });

  it('navigates to the order page for order status notifications', async () => {
    const user = userEvent.setup();
    const notification = makeNotification({
      id: 'ord-n',
      type: 'ORDER_STATUS_UPDATE',
      orderId: 'order-42',
      sessionId: null,
      isRead: true,
    });
    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [notification],
      unreadCount: 0,
      isLoading: false,
      hasMore: false,
      loadNotifications,
      markAsRead,
      refreshUnreadCount: vi.fn(),
      markSessionAsRead: vi.fn(),
    });

    const anchor = document.createElement('div');
    document.body.appendChild(anchor);

    renderWithProviders(
      createElement(NotificationMenu, {
        anchorEl: anchor,
        open: true,
        onClose,
      }),
    );

    await user.click(screen.getByText('Hello from chat'));

    expect(markAsRead).not.toHaveBeenCalled();
    expect(mockRouter.asPath).toBe('/orders/order-42');
  });

  it('marks all unread notifications when "Mark all as read" is clicked', async () => {
    const user = userEvent.setup();
    const a = makeNotification({ id: 'a', content: 'A' });
    const b = makeNotification({ id: 'b', content: 'B' });
    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [a, b],
      unreadCount: 2,
      isLoading: false,
      hasMore: false,
      loadNotifications,
      markAsRead,
      refreshUnreadCount: vi.fn(),
      markSessionAsRead: vi.fn(),
    });

    const anchor = document.createElement('div');
    document.body.appendChild(anchor);

    renderWithProviders(
      createElement(NotificationMenu, {
        anchorEl: anchor,
        open: true,
        onClose,
      }),
    );

    await user.click(screen.getByText('Mark all as read'));

    expect(markAsRead).toHaveBeenCalledWith(['a', 'b']);
  });
});

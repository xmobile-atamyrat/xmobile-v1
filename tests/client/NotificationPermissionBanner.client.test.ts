// @vitest-environment jsdom

import NotificationPermissionBanner from '@/pages/components/NotificationPermissionBanner';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('firebase/messaging', () => ({
  onMessage: vi.fn(() => vi.fn()),
}));

vi.mock('@/pages/lib/serviceWorker', () => ({
  isWebView: () => false,
}));

vi.mock('@/pages/lib/fcm/fcmClient', () => ({
  FCM_TOKEN_REGISTERED_USER_KEY: 'fcm_reg_user',
  FCM_TOKEN_STORAGE_KEY: 'fcm_token',
  getDeviceInfo: vi.fn(() => ({})),
  getFCMToken: vi.fn().mockResolvedValue('mock-token'),
  getNativeNotificationPermissionStatus: vi.fn(),
  hasNotificationPermission: vi.fn(() => false),
  initializeOrGetMessaging: vi.fn().mockResolvedValue({}),
  registerFCMToken: vi.fn().mockResolvedValue(true),
  requestNativeNotificationPermission: vi.fn(),
}));

vi.mock('@/pages/lib/NotificationContext', () => ({
  useNotificationContext: vi.fn(),
}));

vi.mock('@/pages/lib/UserContext', () => ({
  useUserContext: vi.fn(),
}));

/** Single mock type for `vi.stubGlobal('Notification', …)` (max-classes-per-file). */
class MockNotification {
  static permission: NotificationPermission = 'default';

  static requestPermission = vi.fn().mockResolvedValue('granted');
}

describe('NotificationPermissionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockNotification.permission = 'default';
    MockNotification.requestPermission.mockReset();
    MockNotification.requestPermission.mockResolvedValue('granted');
    vi.mocked(useUserContext).mockReturnValue({
      user: { id: 'user-1' } as never,
      setUser: vi.fn(),
      accessToken: 'access-token',
      setAccessToken: vi.fn(),
      isLoading: false,
    });
    vi.mocked(useNotificationContext).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      hasMore: false,
      loadNotifications: vi.fn(),
      markAsRead: vi.fn(),
      markSessionAsRead: vi.fn(),
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows browser notification prompt when permission is still default', () => {
    vi.stubGlobal('Notification', MockNotification);

    renderWithProviders(createElement(NotificationPermissionBanner));

    expect(
      screen.getByText(/Enable browser notifications to receive updates/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Enable')).toBeInTheDocument();
  });

  it('hides the banner after the user dismisses it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Notification', MockNotification);

    renderWithProviders(createElement(NotificationPermissionBanner));

    const dismiss = screen.getAllByRole('button')[0];
    await user.click(dismiss);

    expect(
      screen.queryByText(/Enable browser notifications to receive updates/i),
    ).not.toBeInTheDocument();
  });
});

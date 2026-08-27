import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany, mockDeleteMany, mockSendEachForMulticast, mockApp } =
  vi.hoisted(() => ({
    mockFindMany: vi.fn(),
    mockDeleteMany: vi.fn(),
    mockSendEachForMulticast: vi.fn(),
    mockApp: { name: 'test-app' },
  }));

vi.mock('@/lib/dbClient', () => ({
  default: {
    fCMToken: { findMany: mockFindMany, deleteMany: mockDeleteMany },
    inAppNotification: { updateMany: vi.fn() },
  },
}));

vi.mock('firebase-admin', () => ({
  // initializeOrGetFirebaseApp() short-circuits on an existing app, so mocking
  // app() keeps the credential/fs path out of these tests entirely.
  app: () => mockApp,
  messaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
  initializeApp: vi.fn(),
}));

import { sendFCMNotificationToUser } from '@/lib/fcm/fcmService';
import { FCMNotificationPayload } from '@/lib/fcm/types';

const payload = {
  title: 't',
  body: 'b',
  data: {
    notificationId: 'n1',
    type: 'CHAT_MESSAGE',
    click_action: 'https://x/chat',
  },
} as FCMNotificationPayload;

/** The verbatim message firebase-admin wraps a failed credential mint in. */
const CREDENTIAL_ERROR =
  'Credential implementation provided to initializeApp() via the "credential" ' +
  'property failed to fetch a valid Google OAuth2 access token with the ' +
  'following error: "fetch failed".';

function tokenRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    token: `tok${i}`.padEnd(30, 'x'),
  }));
}

let errorSpy: ReturnType<typeof vi.spyOn>;

describe('sendFCMNotificationToUser failure logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 0 });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs a shared credential failure once, not once per token', async () => {
    mockFindMany.mockResolvedValueOnce(tokenRows(5));
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: tokenRows(5).map(() => ({
        success: false,
        error: { code: 'app/invalid-credential', message: CREDENTIAL_ERROR },
      })),
    });

    const result = await sendFCMNotificationToUser('u1', payload);

    expect(result.tokensFailed).toBe(5);
    // One failed token-mint must not become five Slack alerts.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0].join(' ');
    expect(line).toContain('5');
    expect(line).toContain('fetch failed');
  });

  it('emits one line per distinct error, with the affected token count', async () => {
    mockFindMany.mockResolvedValueOnce(tokenRows(4));
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'app/invalid-credential', message: CREDENTIAL_ERROR },
        },
        {
          success: false,
          error: { code: 'app/invalid-credential', message: CREDENTIAL_ERROR },
        },
        {
          success: false,
          error: {
            code: 'messaging/registration-token-not-registered',
            message: 'not registered',
          },
        },
      ],
    });

    const result = await sendFCMNotificationToUser('u1', payload);

    expect(result.tokensSent).toBe(1);
    expect(result.tokensFailed).toBe(3);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    const lines = errorSpy.mock.calls.map((c: unknown[]) => c.join(' '));
    expect(
      lines.some((l: string) => l.includes('fetch failed') && l.includes('2')),
    ).toBe(true);
    expect(lines.some((l: string) => l.includes('not registered'))).toBe(true);
  });

  it('still prunes stale tokens while logging is grouped', async () => {
    const rows = tokenRows(2);
    mockFindMany.mockResolvedValueOnce(rows);
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [
        {
          success: false,
          error: {
            code: 'messaging/registration-token-not-registered',
            message: 'not registered',
          },
        },
        { success: true },
      ],
    });

    await sendFCMNotificationToUser('u1', payload);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { token: { in: [rows[0].token] } },
    });
  });

  it('logs nothing when every token succeeds', async () => {
    mockFindMany.mockResolvedValueOnce(tokenRows(3));
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [{ success: true }, { success: true }, { success: true }],
    });

    const result = await sendFCMNotificationToUser('u1', payload);

    expect(result.success).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

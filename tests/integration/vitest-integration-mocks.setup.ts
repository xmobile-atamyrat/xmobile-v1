import { vi } from 'vitest';

vi.mock('@/lib/slack', () => ({
  getSlack: vi.fn(() => null),
}));

// Keep the real module (payload builder, delivery recording, retry helper all
// only touch the test DB) — stub just the two functions that talk to FCM, so
// the retry job and API routes never reach the real Firebase from tests.
vi.mock('@/lib/fcm/fcmService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/fcm/fcmService')>()),
  sendFCMWithCallbackFallback: vi.fn().mockResolvedValue(true),
  sendFCMNotificationToUser: vi.fn().mockResolvedValue({
    success: false,
    tokensSent: 0,
    tokensFailed: 0,
    failedTokenIds: [],
    noTokens: true,
  }),
}));

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  }),
);

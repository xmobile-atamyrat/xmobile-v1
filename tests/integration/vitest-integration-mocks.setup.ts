import { vi } from 'vitest';

vi.mock('@/lib/slack', () => ({
  getSlack: vi.fn(() => null),
}));

vi.mock('@/lib/fcm/fcmService', () => ({
  sendFCMWithCallbackFallback: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  }),
);

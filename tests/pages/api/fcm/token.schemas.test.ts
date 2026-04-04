import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/** Keep aligned with `src/pages/api/fcm/token.page.ts`. */
const RegisterTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  deviceInfo: z.string().min(1, 'Device info is required'),
});

const DeleteTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

describe('FCM token API schemas', () => {
  it('RegisterTokenSchema requires non-empty token and deviceInfo', () => {
    expect(
      RegisterTokenSchema.parse({ token: 't', deviceInfo: 'iPhone' }),
    ).toEqual({ token: 't', deviceInfo: 'iPhone' });
    expect(RegisterTokenSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('DeleteTokenSchema requires token', () => {
    expect(DeleteTokenSchema.parse({ token: 'x' })).toEqual({ token: 'x' });
    expect(DeleteTokenSchema.safeParse({}).success).toBe(false);
  });
});

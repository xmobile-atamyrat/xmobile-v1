import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { verifyToken } from '@/pages/api/utils/authMiddleware';

describe('verifyToken', () => {
  it('resolves with payload when the token is valid', async () => {
    const secret = 'verify-token-test-secret';
    const token = jwt.sign({ userId: 'u-42', grade: 'FREE' }, secret, {
      noTimestamp: true,
    });

    const decoded = await verifyToken(token, secret);
    expect(decoded.userId).toBe('u-42');
    expect(decoded.grade).toBe('FREE');
  });

  it('rejects when the token is invalid', async () => {
    await expect(
      verifyToken('not-a-jwt', 'verify-token-test-secret'),
    ).rejects.toBeDefined();
  });
});

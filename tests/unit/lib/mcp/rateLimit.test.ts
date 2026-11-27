import { describe, expect, it } from 'vitest';

import { overRateLimit, REQUESTS_PER_MINUTE } from '@/lib/mcp/rateLimit';

describe('MCP rate limit', () => {
  it('refuses past the limit and lets a retrying client back in', () => {
    const grant = 'grant-retrying';
    const start = 1_000_000;
    for (let i = 0; i < REQUESTS_PER_MINUTE; i += 1) {
      expect(overRateLimit(grant, start + i)).toBe(false);
    }
    expect(overRateLimit(grant, start + 200)).toBe(true);
    // Retrying through the 429s, faster than the limit allows, doesn't
    // push the end of the window back.
    for (let t = start + 1_000; t < start + 60_000; t += 300) {
      expect(overRateLimit(grant, t)).toBe(true);
    }
    expect(overRateLimit(grant, start + 60_000)).toBe(false);
  });

  it('counts each grant on its own', () => {
    const start = 5_000_000;
    for (let i = 0; i < REQUESTS_PER_MINUTE; i += 1) {
      overRateLimit('grant-busy', start + i);
    }
    expect(overRateLimit('grant-busy', start + 500)).toBe(true);
    expect(overRateLimit('grant-quiet', start + 500)).toBe(false);
  });
});

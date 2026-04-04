import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolve4 } = vi.hoisted(() => ({
  mockResolve4: vi.fn(),
}));

vi.mock('dns/promises', () => ({
  default: {
    resolve4: mockResolve4,
  },
}));

import { SlackIpCache } from '@/lib/slack/ipCache';

describe('SlackIpCache', () => {
  let cache: SlackIpCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SlackIpCache();
    mockResolve4.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches DNS results until TTL expires', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    const first = await cache.resolveHostname('example.com');
    expect(first).toEqual(['10.0.0.1']);
    expect(mockResolve4).toHaveBeenCalledTimes(1);

    const second = await cache.resolveHostname('example.com');
    expect(second).toEqual(['10.0.0.1']);
    expect(mockResolve4).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(16 * 60 * 1000);
    mockResolve4.mockResolvedValue(['10.0.0.2']);
    const third = await cache.resolveHostname('example.com');
    expect(third).toEqual(['10.0.0.2']);
    expect(mockResolve4).toHaveBeenCalledTimes(2);
  });

  it('filters out non-IPv4-looking strings from DNS', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.5', 'not-an-ip']);
    const ips = await cache.resolveHostname('x.test');
    expect(ips).toEqual(['10.0.0.5']);
  });

  it('getIpsToTry puts working IPs first (non-slack host has no seed IPs)', async () => {
    mockResolve4.mockResolvedValue(['1.1.1.1', '2.2.2.2']);
    cache.markIpAsWorking('api.example.com', '2.2.2.2');
    const ordered = await cache.getIpsToTry('api.example.com');
    expect(ordered[0]).toBe('2.2.2.2');
    expect(ordered).toContain('1.1.1.1');
  });

  it('clearCache resets state', async () => {
    mockResolve4.mockResolvedValue(['9.9.9.9']);
    await cache.resolveHostname('z.com');
    cache.clearCache();
    await cache.resolveHostname('z.com');
    expect(mockResolve4).toHaveBeenCalledTimes(2);
  });
});

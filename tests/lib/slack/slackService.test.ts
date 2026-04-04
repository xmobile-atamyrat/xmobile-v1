import { afterEach, describe, expect, it, vi } from 'vitest';

describe('slackService', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    const { clearSlackClientsCache } = await import('@/lib/slack/slackService');
    clearSlackClientsCache();
  });

  it('getAvailableSlackClients returns env names without SLACK_ prefix', async () => {
    vi.stubEnv('SLACK_ORDER_BOT_WEBHOOK', 'https://hooks.example/test');
    const { getAvailableSlackClients } = await import(
      '@/lib/slack/slackService'
    );
    expect(getAvailableSlackClients()).toContain('ORDER_BOT_WEBHOOK');
  });

  it('getSlack returns null when webhook env is unset', async () => {
    const { getSlack } = await import('@/lib/slack/slackService');
    expect(getSlack('NONEXISTENT_BOT_XYZ')).toBeNull();
  });

  it('getSlack returns the same cached instance', async () => {
    vi.stubEnv('SLACK_CACHED_BOT', 'https://hooks.slack.com/services/fake');
    const { getSlack } = await import('@/lib/slack/slackService');
    const a = getSlack('CACHED_BOT');
    const b = getSlack('CACHED_BOT');
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});

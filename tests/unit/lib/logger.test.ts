import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
const getSlackMock = vi.fn();

vi.mock('@/lib/slack', () => ({
  getSlack: (...args: unknown[]) => getSlackMock(...args),
}));

const globalForLogger = global as unknown as { isLoggerInitialized?: boolean };
const realConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
};

/** A fresh logger module, as a new process would load it. */
async function initLogger() {
  vi.resetModules();
  const { initSlackLogger } = await import('@/lib/logger');
  initSlackLogger();
}

describe('initSlackLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSlackMock.mockReturnValue({ send: sendMock });
    sendMock.mockResolvedValue(undefined);
    globalForLogger.isLoggerInitialized = false;
    vi.stubEnv('SLACK_LOG_LEVEL', 'ERROR');
    // Stand-ins for the real console, so the logger's pass-through stays quiet.
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    Object.assign(console, realConsole);
    globalForLogger.isLoggerInitialized = false;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(['development', 'test'])(
    'never reaches Slack under NODE_ENV=%s',
    async (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      const passThrough = console.error;

      await initLogger();
      console.error('fetch failed');
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(console.error).toBe(passThrough);
      expect(getSlackMock).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
    },
  );

  it('alerts from a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await initLogger();
    console.error('fetch failed');

    await vi.waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith(
        expect.stringContaining('fetch failed'),
      ),
    );
    expect(getSlackMock).toHaveBeenCalledWith('ALERTS_BOT_WEBHOOK');
  });

  it('alerts when NODE_ENV is unset, as for the VM ws-server and batch-runner', async () => {
    vi.stubEnv('NODE_ENV', undefined);

    await initLogger();
    console.error('job crashed');

    await vi.waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith(
        expect.stringContaining('job crashed'),
      ),
    );
  });
});

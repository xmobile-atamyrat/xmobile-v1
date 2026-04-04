import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('logUtils (dev)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('validateLogFilename accepts safe .log names only', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { validateLogFilename } = await import(
      '@/pages/api/server-logs/utils/logUtils'
    );

    expect(validateLogFilename('app.log')).toBe(true);
    expect(validateLogFilename('my_app-1.2.log')).toBe(true);
    expect(validateLogFilename('../escape.log')).toBe(false);
    expect(validateLogFilename('no-extension')).toBe(false);
    expect(validateLogFilename('x.txt')).toBe(false);
  });

  it('resolveLogPath joins filename under the logs directory', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { resolveLogPath } = await import(
      '@/pages/api/server-logs/utils/logUtils'
    );
    const resolved = resolveLogPath('server.log');
    expect(resolved).toBe(path.resolve('./logs', 'server.log'));
  });

  it('resolveLogPath rejects invalid filenames', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { resolveLogPath } = await import(
      '@/pages/api/server-logs/utils/logUtils'
    );
    expect(() => resolveLogPath('nope.txt')).toThrow('Invalid log filename');
  });
});

describe('logUtils (production path root)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('resolveLogPath stays under production logs directory', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { resolveLogPath } = await import(
      '@/pages/api/server-logs/utils/logUtils'
    );
    const resolved = resolveLogPath('prod.log');
    expect(resolved.startsWith(path.resolve('/home/ubuntu/scripts'))).toBe(
      true,
    );
  });
});

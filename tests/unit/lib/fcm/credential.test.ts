import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOAuth2GoogleapisCredential,
  TokenTransport,
} from '@/lib/fcm/credential';

// A real key pair — createSignedJwt() actually signs, so a dummy string won't do.
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const serviceAccount = {
  client_email: 'svc@test.iam.gserviceaccount.com',
  private_key: privateKey as string,
};

const okBody = JSON.stringify({ access_token: 'at-1', expires_in: 3600 });

function makeCredential(transport: TokenTransport) {
  // Zero delays keep the retry path synchronous-fast; cooldown is exercised
  // explicitly by the test that cares about it.
  return createOAuth2GoogleapisCredential(serviceAccount, {
    transport,
    retryDelayMs: 0,
    failureCooldownMs: 30_000,
  });
}

describe('createOAuth2GoogleapisCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mints a token and reuses it instead of re-minting', async () => {
    const transport = vi.fn().mockResolvedValue({ status: 200, body: okBody });
    const cred = makeCredential(transport);

    const first = await cred.getAccessToken();
    const second = await cred.getAccessToken();

    expect(first).toEqual({ access_token: 'at-1', expires_in: 3600 });
    expect(second).toEqual(first);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('retries a transient network failure instead of failing the send', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        }),
      )
      .mockResolvedValueOnce({ status: 200, body: okBody });
    const cred = makeCredential(transport);

    await expect(cred.getAccessToken()).resolves.toEqual({
      access_token: 'at-1',
      expires_in: 3600,
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 attempts and names the underlying cause', async () => {
    const transport = vi.fn().mockRejectedValue(
      Object.assign(new Error('connect ETIMEDOUT 142.250.1.1:443'), {
        code: 'ETIMEDOUT',
      }),
    );
    const cred = makeCredential(transport);

    // The whole point: "fetch failed" must become something actionable.
    await expect(cred.getAccessToken()).rejects.toThrow(/ETIMEDOUT/);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('does not burn retries on a deterministic 4xx', async () => {
    const transport = vi.fn().mockResolvedValue({
      status: 400,
      body: '{"error":"invalid_grant"}',
    });
    const cred = makeCredential(transport);

    await expect(cred.getAccessToken()).rejects.toThrow(/invalid_grant/);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, body: 'unavailable' })
      .mockResolvedValueOnce({ status: 200, body: okBody });
    const cred = makeCredential(transport);

    await expect(cred.getAccessToken()).resolves.toMatchObject({
      access_token: 'at-1',
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent mints into a single network call', async () => {
    let release: (v: unknown) => void = () => {};
    const gate = new Promise((r) => {
      release = r;
    });
    const transport = vi
      .fn()
      .mockImplementation(() =>
        gate.then(() => ({ status: 200, body: okBody })),
      );
    const cred = makeCredential(transport);

    // sendEachForMulticast fans out per token; they must not each mint.
    const all = Promise.all(
      Array.from({ length: 5 }, () => cred.getAccessToken()),
    );
    release(null);
    await all;

    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('cools down after a failure so a retry burst cannot hammer the network', async () => {
    const transport = vi
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED'));
    const cred = makeCredential(transport);

    await expect(cred.getAccessToken()).rejects.toThrow();
    expect(transport).toHaveBeenCalledTimes(3);

    // Second caller inside the cooldown window must fail fast, no new attempts.
    await expect(cred.getAccessToken()).rejects.toThrow(/ECONNREFUSED/);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('recovers once the cooldown expires', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValue({ status: 200, body: okBody });
    const cred = createOAuth2GoogleapisCredential(serviceAccount, {
      transport,
      retryDelayMs: 0,
      failureCooldownMs: 0,
    });

    await expect(cred.getAccessToken()).rejects.toThrow();
    await expect(cred.getAccessToken()).resolves.toMatchObject({
      access_token: 'at-1',
    });
  });
});

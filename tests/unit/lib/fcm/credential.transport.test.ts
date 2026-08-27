import { EventEmitter } from 'events';
import { URL } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest, mockGetIpsToTry, mockMarkIpAsWorking } = vi.hoisted(
  () => ({
    mockRequest: vi.fn(),
    mockGetIpsToTry: vi.fn(),
    mockMarkIpAsWorking: vi.fn(),
  }),
);

vi.mock('https', () => ({
  default: { request: mockRequest },
  request: mockRequest,
}));

vi.mock('../slack/ipCache', () => ({
  slackIpCache: {
    getIpsToTry: mockGetIpsToTry,
    markIpAsWorking: mockMarkIpAsWorking,
  },
}));

// The module under test imports '../slack/ipCache' relative to src/lib/fcm.
vi.mock('@/lib/slack/ipCache', () => ({
  slackIpCache: {
    getIpsToTry: mockGetIpsToTry,
    markIpAsWorking: mockMarkIpAsWorking,
  },
}));

import { ipRotatingTransport } from '@/lib/fcm/credential';

const url = new URL('https://oauth2.googleapis.com/token');
const FORM = 'grant_type=x&assertion=y';

/** Fake `https.request`: resolves with a status/body, or emits an error. */
function respondWith(status: number, body: string) {
  return (_options: any, callback: (res: any) => void) => {
    const req: any = new EventEmitter();
    req.write = vi.fn();
    req.end = vi.fn(() => {
      const res: any = new EventEmitter();
      res.statusCode = status;
      // Defer so the caller can attach listeners first.
      setImmediate(() => {
        res.emit('data', body);
        res.emit('end');
      });
      callback(res);
    });
    req.destroy = vi.fn();
    return req;
  };
}

function failWith(code: string) {
  return () => {
    const req: any = new EventEmitter();
    req.write = vi.fn();
    req.end = vi.fn(() => {
      setImmediate(() =>
        req.emit(
          'error',
          Object.assign(new Error(`connect ${code}`), { code }),
        ),
      );
    });
    req.destroy = vi.fn();
    return req;
  };
}

describe('ipRotatingTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the first reachable IP and remembers it', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1', '2.2.2.2']);
    mockRequest.mockImplementationOnce(respondWith(200, '{"ok":true}'));

    const res = await ipRotatingTransport(url, FORM);

    expect(res).toEqual({ status: 200, body: '{"ok":true}' });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockMarkIpAsWorking).toHaveBeenCalledWith(
      'oauth2.googleapis.com',
      '1.1.1.1',
    );
  });

  it('pins the socket to the IP while keeping SNI and Host on the real name', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1']);
    mockRequest.mockImplementationOnce(respondWith(200, 'ok'));

    await ipRotatingTransport(url, FORM);

    const options = mockRequest.mock.calls[0][0];
    // This is the whole reason the workaround exists: the firewall filters on
    // SNI, so the TLS name must stay oauth2.googleapis.com.
    expect(options.hostname).toBe('1.1.1.1');
    expect(options.servername).toBe('oauth2.googleapis.com');
    expect(options.headers.Host).toBe('oauth2.googleapis.com');
    expect(options.method).toBe('POST');
    expect(options.timeout).toBe(10_000);
  });

  it('rotates to the next IP when one is blackholed', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1', '2.2.2.2']);
    mockRequest
      .mockImplementationOnce(failWith('ECONNREFUSED'))
      .mockImplementationOnce(respondWith(200, 'ok'));

    const res = await ipRotatingTransport(url, FORM);

    expect(res.status).toBe(200);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockMarkIpAsWorking).toHaveBeenCalledWith(
      'oauth2.googleapis.com',
      '2.2.2.2',
    );
    expect(mockMarkIpAsWorking).toHaveBeenCalledTimes(1);
  });

  it('falls back to hostname resolution after every IP fails', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1', '2.2.2.2']);
    mockRequest
      .mockImplementationOnce(failWith('ECONNREFUSED'))
      .mockImplementationOnce(failWith('EHOSTUNREACH'))
      .mockImplementationOnce(respondWith(200, 'ok'));

    const res = await ipRotatingTransport(url, FORM);

    expect(res.status).toBe(200);
    expect(mockRequest).toHaveBeenCalledTimes(3);
    // The fallback dials the name, so no IP pinning.
    expect(mockRequest.mock.calls[2][0].hostname).toBe('oauth2.googleapis.com');
    expect(mockRequest.mock.calls[2][0].servername).toBeUndefined();
    expect(mockMarkIpAsWorking).not.toHaveBeenCalled();
  });

  it('goes straight to hostname when DNS itself fails', async () => {
    mockGetIpsToTry.mockRejectedValueOnce(new Error('ENOTFOUND'));
    mockRequest.mockImplementationOnce(respondWith(200, 'ok'));

    const res = await ipRotatingTransport(url, FORM);

    expect(res.status).toBe(200);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][0].hostname).toBe('oauth2.googleapis.com');
  });

  it('aggregates every route failure into one diagnosable error', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1', '2.2.2.2']);
    mockRequest
      .mockImplementationOnce(failWith('ECONNREFUSED'))
      .mockImplementationOnce(failWith('EHOSTUNREACH'))
      .mockImplementationOnce(failWith('ETIMEDOUT'));

    const error = await ipRotatingTransport(url, FORM).catch((e) => e);

    expect(error.message).toContain('1.1.1.1');
    expect(error.message).toContain('ECONNREFUSED');
    expect(error.message).toContain('2.2.2.2');
    expect(error.message).toContain('EHOSTUNREACH');
    expect(error.message).toContain('oauth2.googleapis.com');
    expect(error.message).toContain('ETIMEDOUT');
  });

  it('returns a non-2xx body rather than treating it as unreachable', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1']);
    mockRequest.mockImplementationOnce(
      respondWith(400, '{"error":"invalid_grant"}'),
    );

    const res = await ipRotatingTransport(url, FORM);

    expect(res).toEqual({ status: 400, body: '{"error":"invalid_grant"}' });
    // A 400 still proves the route works — that distinction is what stops a
    // credential problem from evicting a perfectly good IP.
    expect(mockMarkIpAsWorking).toHaveBeenCalledWith(
      'oauth2.googleapis.com',
      '1.1.1.1',
    );
  });

  it('destroys the request when it times out', async () => {
    mockGetIpsToTry.mockResolvedValueOnce(['1.1.1.1']);
    let captured: any;
    mockRequest.mockImplementationOnce(() => {
      const req: any = new EventEmitter();
      req.write = vi.fn();
      req.end = vi.fn(() => setImmediate(() => req.emit('timeout')));
      req.destroy = vi.fn((err: Error) => req.emit('error', err));
      captured = req;
      return req;
    });

    const error = await ipRotatingTransport(url, FORM).catch((e) => e);

    expect(captured.destroy).toHaveBeenCalled();
    expect(error.message).toMatch(/timeout after 10000ms/);
  });
});

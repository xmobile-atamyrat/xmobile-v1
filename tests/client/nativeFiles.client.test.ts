// @vitest-environment jsdom

import {
  hasNativeFiles,
  isInApp,
  sendFilesToApp,
} from '@/pages/lib/nativeFiles';
import { afterEach, describe, expect, it, vi } from 'vitest';

type TestWindow = Window & {
  ReactNativeWebView?: { postMessage: (m: string) => void };
  __XMOBILE_NATIVE_FILES__?: number;
};
const win = window as TestWindow;

const xlsx = (name: string, text = 'hello') =>
  new File([text], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

/** Plays the app: answers each request with `status`. */
function installApp(status: string) {
  const postMessage = vi.fn((raw: string) => {
    const { payload } = JSON.parse(raw);
    setTimeout(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'FILES_RESULT',
            payload: { requestId: payload.requestId, status },
          },
        }),
      ),
    );
  });
  win.ReactNativeWebView = { postMessage };
  // eslint-disable-next-line no-underscore-dangle
  win.__XMOBILE_NATIVE_FILES__ = 1;
  return postMessage;
}

afterEach(() => {
  delete win.ReactNativeWebView;
  // eslint-disable-next-line no-underscore-dangle
  delete win.__XMOBILE_NATIVE_FILES__;
});

describe('nativeFiles bridge', () => {
  it('detects the app and whether it supports files', () => {
    expect(isInApp()).toBe(false);
    expect(hasNativeFiles()).toBe(false);
    win.ReactNativeWebView = { postMessage: vi.fn() };
    expect(isInApp()).toBe(true);
    expect(hasNativeFiles()).toBe(false); // old app: no flag
    // eslint-disable-next-line no-underscore-dangle
    win.__XMOBILE_NATIVE_FILES__ = 1;
    expect(hasNativeFiles()).toBe(true);
  });

  it('sends every file as base64 with its real name and returns the status', async () => {
    const postMessage = installApp('shared');
    const status = await sendFilesToApp(
      'share',
      [xlsx('Rahmanov-Store A-03-11-2026-TBF.xlsx'), xlsx('b.xlsx', 'xy')],
      'Store A',
    );

    expect(status).toBe('shared');
    const message = JSON.parse(postMessage.mock.calls[0][0]);
    expect(message.type).toBe('SHARE_FILES');
    expect(message.payload.title).toBe('Store A');
    expect(message.payload.files).toEqual([
      {
        name: 'Rahmanov-Store A-03-11-2026-TBF.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: btoa('hello'),
      },
      {
        name: 'b.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        base64: btoa('xy'),
      },
    ]);
  });

  it('uses SAVE_FILES for save and ignores answers to other requests', async () => {
    const postMessage = vi.fn((raw: string) => {
      const { payload } = JSON.parse(raw);
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'FILES_RESULT',
              payload: { requestId: 'someone-else', status: 'failed' },
            },
          }),
        );
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'FILES_RESULT',
              payload: { requestId: payload.requestId, status: 'saved' },
            },
          }),
        );
      });
    });
    win.ReactNativeWebView = { postMessage };

    await expect(sendFilesToApp('save', [xlsx('a.xlsx')])).resolves.toBe(
      'saved',
    );
    expect(JSON.parse(postMessage.mock.calls[0][0]).type).toBe('SAVE_FILES');
  });

  it('fails without the app or without files', async () => {
    await expect(sendFilesToApp('share', [xlsx('a.xlsx')])).resolves.toBe(
      'failed',
    );
    installApp('shared');
    await expect(sendFilesToApp('share', [])).resolves.toBe('failed');
  });

  it('encodes files larger than one base64 chunk correctly', async () => {
    const postMessage = installApp('shared');
    const big = 'x'.repeat(100_000);
    await sendFilesToApp('share', [xlsx('big.xlsx', big)]);
    const { files } = JSON.parse(postMessage.mock.calls[0][0]).payload;
    expect(atob(files[0].base64)).toBe(big);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  downloadImage,
  ImageDownloadError,
  isAllowedImageUrl,
  MAX_IMAGE_DOWNLOAD_BYTES,
} from '@/lib/mcp/imageDownload';

const GOOD_URL =
  'https://oaisdmntprseasia.blob.core.windows.net/files/abc?se=2026-11-26&sig=x';

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

describe('isAllowedImageUrl', () => {
  it('accepts ChatGPT file storage links', () => {
    expect(isAllowedImageUrl(GOOD_URL)).toBe(true);
    expect(
      isAllowedImageUrl('https://oaisdmntprwestus.blob.core.windows.net/x'),
    ).toBe(true);
  });

  it.each([
    ['plain http', 'http://oaisdmntprseasia.blob.core.windows.net/x'],
    ['another storage account', 'https://evil.blob.core.windows.net/x'],
    [
      'a look-alike suffix',
      'https://oaisdmntprseasia.blob.core.windows.net.evil.com/x',
    ],
    ['credentials', 'https://u:p@oaisdmntprseasia.blob.core.windows.net/x'],
    [
      'an explicit port',
      'https://oaisdmntprseasia.blob.core.windows.net:8443/x',
    ],
    ['an internal host', 'https://127.0.0.1/x'],
    ['the metadata service', 'http://169.254.169.254/latest/meta-data'],
    ['the OpenAI CDN', 'https://files.oaiusercontent.com/x'],
    ['not a URL', 'file:///etc/passwd'],
  ])('refuses %s', (_label, url) => {
    expect(isAllowedImageUrl(url)).toBe(false);
  });
});

describe('downloadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never fetches a refused URL and names its host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const error = await downloadImage('https://example.com/a.png').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ImageDownloadError);
    expect((error as ImageDownloadError).refusedHost).toBe('example.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the bytes and does not follow redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const buffer = await downloadImage(GOOD_URL);
    expect([...buffer]).toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses a redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/' },
        }),
      ),
    );
    await expect(downloadImage(GOOD_URL)).rejects.toThrow(/redirect/);
  });

  it('refuses an oversized declared length without reading it, and closes it', async () => {
    const response = new Response(streamOf([new Uint8Array([1])]), {
      status: 200,
      headers: { 'content-length': String(MAX_IMAGE_DOWNLOAD_BYTES + 1) },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(downloadImage(GOOD_URL)).rejects.toThrow(/10 MB/);
    // Cancelled, so its connection doesn't wait for garbage collection.
    expect(response.bodyUsed).toBe(true);
  });

  it('stops reading once the stream passes the cap', async () => {
    const big = new Uint8Array(4 * 1024 * 1024);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(streamOf([big, big, big]), { status: 200 }),
        ),
    );
    await expect(downloadImage(GOOD_URL)).rejects.toThrow(/10 MB/);
  });

  it('reports an expired link, closing its body', async () => {
    const response = new Response('no', { status: 403 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(downloadImage(GOOD_URL)).rejects.toThrow(/403/);
    expect(response.bodyUsed).toBe(true);
  });

  it('reports a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('refused')));
    await expect(downloadImage(GOOD_URL)).rejects.toThrow(/Could not reach/);
  });
});

/**
 * Fetches an image ChatGPT handed to a tool (`openai/fileParams` gives a
 * short-lived `download_url`). The server makes this request, so it is
 * locked down against being pointed anywhere else (SSRF): https only, one
 * family of hosts, no redirects, a size cap and a timeout.
 */
import { urlHost } from './config';

/**
 * ChatGPT's file links are on its Azure storage accounts, e.g.
 * `oaisdmntprseasia.blob.core.windows.net`. A storage account anyone
 * registers with this prefix would pass too; that only lets them hand over an
 * image, which anyone can already do by pasting one into the chat, and
 * nothing internal is reachable through it.
 */
const ALLOWED_HOST = /^oaisdmntpr[a-z0-9]{1,14}\.blob\.core\.windows\.net$/;

export const MAX_IMAGE_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

export class ImageDownloadError extends Error {
  constructor(
    message: string,
    /** Set when the URL itself was refused, as opposed to a failed transfer. */
    public readonly refusedHost: string | null = null,
  ) {
    super(message);
  }
}

export function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      ALLOWED_HOST.test(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export async function downloadImage(rawUrl: string): Promise<Buffer> {
  if (!isAllowedImageUrl(rawUrl)) {
    throw new ImageDownloadError(
      'This image link is not from ChatGPT, so it was not downloaded. Attach or generate the image in ChatGPT and pass it as the image argument.',
      urlHost(rawUrl) ?? '(not a URL)',
    );
  }

  let response: Response;
  try {
    response = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: { Accept: 'image/*' },
    });
  } catch {
    throw new ImageDownloadError(
      'Could not reach ChatGPT file storage from the xmobile server. Try again in a minute.',
    );
  }
  // A body left unread keeps its connection open until garbage collection.
  const refuse = (message: string): never => {
    response.body?.cancel().catch(() => undefined);
    throw new ImageDownloadError(message);
  };
  if (response.status >= 300 && response.status < 400) {
    refuse('The image link redirected; refused.');
  }
  if (!response.ok || response.body == null) {
    refuse(
      `The image link answered ${response.status}. It may have expired; ask again with the image attached.`,
    );
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_DOWNLOAD_BYTES) {
    refuse('The image is larger than 10 MB.');
  }

  // Counted while streaming: Content-Length can be missing or wrong.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_DOWNLOAD_BYTES) {
        throw new ImageDownloadError('The image is larger than 10 MB.');
      }
      chunks.push(value);
    }
  } catch (error) {
    reader.cancel().catch(() => undefined);
    if (error instanceof ImageDownloadError) throw error;
    throw new ImageDownloadError('The image download was interrupted.');
  }
  return Buffer.concat(chunks);
}

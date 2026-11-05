import { NativeModules } from 'react-native';

/**
 * Saving and sharing files the web app builds in the page (procurement .xlsx).
 * Android WebView ignores blob downloads and has no Web Share API, and iOS
 * WKWebView is unreliable with both, so the page hands the files to the app
 * over the WebView bridge (SHARE_FILES / SAVE_FILES) and the native
 * `XFileShare` module does the work. Contract: the module writes each file
 * under its real name and opens the share sheet / "save to" UI.
 */

export type BridgeFile = { name: string; mimeType: string; base64: string };
export type FilesStatus = 'shared' | 'saved' | 'cancelled';
export type FilesRequest = {
  requestId: string;
  title?: string | null;
  files: BridgeFile[];
};

/** Set by injectedJavaScriptBeforeContentLoaded so the page knows we can. */
export const NATIVE_FILES_FLAG_JS = 'window.__XMOBILE_NATIVE_FILES__ = 1;';

// Keeps a runaway page from pushing huge payloads through the bridge.
const MAX_FILES = 50;
const MAX_TOTAL_BASE64_CHARS = 40 * 1024 * 1024;

type XFileShareModule = {
  share(files: BridgeFile[], title: string | null): Promise<FilesStatus>;
  save(files: BridgeFile[], title: string | null): Promise<FilesStatus>;
};

const getModule = (): XFileShareModule | undefined =>
  NativeModules.XFileShare as XFileShareModule | undefined;

/** Validates a SHARE_FILES / SAVE_FILES payload from the page. */
export function parseFilesRequest(payload: unknown): FilesRequest | null {
  if (payload == null || typeof payload !== 'object') return null;
  const { requestId, title, files } = payload as Record<string, unknown>;
  if (typeof requestId !== 'string' || requestId === '') return null;
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES)
    return null;
  let total = 0;
  for (const file of files) {
    if (file == null || typeof file !== 'object') return null;
    const { name, mimeType, base64 } = file as Record<string, unknown>;
    if (
      typeof name !== 'string' ||
      name.trim() === '' ||
      typeof mimeType !== 'string' ||
      typeof base64 !== 'string' ||
      base64 === ''
    ) {
      return null;
    }
    total += base64.length;
  }
  if (total > MAX_TOTAL_BASE64_CHARS) return null;
  return {
    requestId,
    title: typeof title === 'string' ? title : null,
    files: files as BridgeFile[],
  };
}

export type FilesResult = {
  requestId: string;
  status: FilesStatus | 'failed';
  error?: string;
};

/** Runs one request against the native module; never throws. */
export async function handleFilesRequest(
  mode: 'share' | 'save',
  payload: unknown,
): Promise<FilesResult | null> {
  const request = parseFilesRequest(payload);
  if (!request) {
    const requestId =
      payload && typeof (payload as any).requestId === 'string'
        ? (payload as any).requestId
        : null;
    return requestId
      ? { requestId, status: 'failed', error: 'invalid request' }
      : null;
  }
  const module = getModule();
  if (!module) {
    return {
      requestId: request.requestId,
      status: 'failed',
      error: 'XFileShare is not available',
    };
  }
  try {
    const status =
      mode === 'share'
        ? await module.share(request.files, request.title ?? null)
        : await module.save(request.files, request.title ?? null);
    return { requestId: request.requestId, status };
  } catch (error) {
    return {
      requestId: request.requestId,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** JS that delivers a result to the page the same way other replies do. */
export function filesResultScript(result: FilesResult): string {
  const data = JSON.stringify({ type: 'FILES_RESULT', payload: result });
  return `window.dispatchEvent(new MessageEvent('message', { data: ${data} })); true;`;
}

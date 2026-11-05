/**
 * Hands files built in the page to the mobile app (RN WebView), which saves
 * or shares them natively. Android WebView ignores blob downloads and has no
 * Web Share API, so inside the app this is the only way out for a file.
 * Protocol: mobile/src/lib/nativeFiles.ts (SHARE_FILES / SAVE_FILES ->
 * FILES_RESULT). The app sets `__XMOBILE_NATIVE_FILES__` when it supports it.
 */

export type NativeFilesStatus = 'shared' | 'saved' | 'cancelled' | 'failed';

type RNWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
  // eslint-disable-next-line no-underscore-dangle
  __XMOBILE_NATIVE_FILES__?: number;
};

const rnWindow = (): RNWindow | undefined =>
  typeof window === 'undefined' ? undefined : (window as RNWindow);

/** Running inside the mobile app's WebView (any version). */
export const isInApp = (): boolean => Boolean(rnWindow()?.ReactNativeWebView);

/** The app can save/share files (versions with the XFileShare module). */
export const hasNativeFiles = (): boolean =>
  // eslint-disable-next-line no-underscore-dangle
  isInApp() && (rnWindow()?.__XMOBILE_NATIVE_FILES__ ?? 0) >= 1;

const toBase64 = async (file: Blob): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

/** Sends files to the app; resolves when the app reports back. */
export async function sendFilesToApp(
  mode: 'share' | 'save',
  files: File[],
  title?: string,
): Promise<NativeFilesStatus> {
  const win = rnWindow();
  if (!win?.ReactNativeWebView || files.length === 0) return 'failed';
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = {
    requestId,
    title: title ?? null,
    files: await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: await toBase64(file),
      })),
    ),
  };

  return new Promise<NativeFilesStatus>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (event: MessageEvent) => {
      const { data } = event;
      if (
        data?.type !== 'FILES_RESULT' ||
        data.payload?.requestId !== requestId
      )
        return;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve((data.payload.status as NativeFilesStatus) ?? 'failed');
    };
    // The share sheet can stay open a long time; this only stops a leak if
    // the app never answers.
    timer = setTimeout(
      () => {
        window.removeEventListener('message', onMessage);
        resolve('failed');
      },
      10 * 60 * 1000,
    );
    window.addEventListener('message', onMessage);
    win.ReactNativeWebView!.postMessage(
      JSON.stringify({
        type: mode === 'share' ? 'SHARE_FILES' : 'SAVE_FILES',
        payload,
      }),
    );
  });
}

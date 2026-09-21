export type WebViewErrorDetail = {
  code: number;
  description: string;
  url?: string;
};

export type WebViewErrorKind = 'ignore' | 'transient' | 'certificate' | 'fatal';

const ANDROID_TRANSIENT = new Set([-1, -2, -6, -7, -8, -15]);

const ANDROID_SSL_HANDSHAKE = -11;

const IOS_CANCELLED = -999;

const IOS_TRANSIENT = new Set([-1001, -1003, -1004, -1005, -1009]);

const IOS_CERT_RANGE_MAX = -1200;
const IOS_CERT_RANGE_MIN = -1206;

export const LOAD_DEADLINE_CODE = -10000;

export const LOAD_DEADLINE_ERROR: WebViewErrorDetail = {
  code: LOAD_DEADLINE_CODE,
  description: 'Load deadline exceeded',
};

export function classifyWebViewError(
  detail: Pick<WebViewErrorDetail, 'code' | 'description'>,
): WebViewErrorKind {
  const { code, description } = detail;

  if (typeof description === 'string' && description.startsWith('SSL error:')) {
    return 'certificate';
  }
  if (code === ANDROID_SSL_HANDSHAKE) {
    return 'certificate';
  }
  if (code <= IOS_CERT_RANGE_MAX && code >= IOS_CERT_RANGE_MIN) {
    return 'certificate';
  }
  if (code === IOS_CANCELLED) {
    return 'ignore';
  }
  if (ANDROID_TRANSIENT.has(code) || IOS_TRANSIENT.has(code)) {
    return 'transient';
  }
  return 'fatal';
}

export function formatDiagnostics(
  detail: Pick<WebViewErrorDetail, 'code'>,
  platform: string,
): string {
  return `${platform} ${detail.code}`;
}

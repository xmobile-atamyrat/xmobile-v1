import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Origins allowed to make credentialed cross-origin calls.
 *
 * `Access-Control-Allow-Origin: *` cannot be combined with credentials -- the
 * browser rejects the response outright -- so a caller that sends cookies or an
 * Authorization header needs its own origin echoed back. Echoing whatever
 * `Origin` arrives would let any site on the internet read a signed-in user's
 * data, so this stays an allowlist.
 *
 * Staging needs two entries: the native app loads its WebView from the bare-IP
 * origin while the bundle it runs calls BASE_URL (`dev.xmobile.com.tm`), so
 * every API call it makes is cross-origin between the two.
 */
const ALLOWED_ORIGINS = new Set([
  'https://xmobile.com.tm',
  'https://www.xmobile.com.tm',
  'http://dev.xmobile.com.tm',
  'http://216.250.13.115:3001',
]);

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;

  // Metro serves the dev app from a local origin on an arbitrary port. Never
  // in production, where a page on the developer's own machine would other-
  // wise be trusted with their session.
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') return false;
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Add `Origin` to Vary without dropping a value Next already set. */
function varyOnOrigin(res: NextApiResponse) {
  const existing = res.getHeader('Vary');
  const values = Array.isArray(existing)
    ? existing
    : String(existing ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

  if (!values.some((value) => value.toLowerCase() === 'origin')) {
    values.push('Origin');
  }
  res.setHeader('Vary', values.join(', '));
}

/**
 * Apply CORS headers, and answer a preflight outright.
 *
 * @returns `true` when the request was a preflight and has been answered -- the
 * caller must return immediately, since the response is already finished.
 *
 * A preflight used to fall through to the route's method routing and come back
 * `405`, which fails the check (it has to be a 2xx). Every cross-origin write
 * from the native app was therefore blocked in the browser before it was ever
 * sent, and the caller only saw a rejected promise.
 */
export default function addCors(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  const origin = req.headers.origin;

  if (typeof origin === 'string' && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Unknown origins keep the open, credential-less access they had before.
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  // The response body depends on Origin either way, so it must never be cached
  // under one origin and served to another.
  varyOnOrigin(res);

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Content-Type, Accept, Authorization',
  );
  // useFetchWithCreds() reads a rotated access token off the response; without
  // this the header is invisible to cross-origin callers.
  res.setHeader('Access-Control-Expose-Headers', 'Authorization');
  res.setHeader('X-Robots-Tag', 'noindex');

  if (req.method === 'OPTIONS') {
    // Cache the preflight so it is not repeated before every single call.
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }

  return false;
}

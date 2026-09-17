import {
  AUTH_REFRESH_COOKIE_NAME,
  GUEST_SESSION_COOKIE_NAME,
} from '@/pages/lib/constants';

/**
 * Hosts that must not share a cookie namespace with production.
 *
 * Staging is served from `dev.xmobile.com.tm` -- a subdomain of the production
 * host -- over plain HTTP. Production writes `GUEST_SESSION_ID` and
 * `REFRESH_TOKEN` with `Secure`, and a browser refuses to let an insecure
 * origin write a cookie whose name is already held as `Secure` somewhere in the
 * same domain tree. Staging's own session cookies were therefore dropped on the
 * floor in any browser that had also visited production: every request minted a
 * fresh guest session, so an add-to-cart answered 200 and the cart still read
 * back empty, and a rotated refresh token never stuck.
 *
 * Giving those hosts their own cookie names sidesteps the collision without
 * needing a certificate for staging.
 */
const NAMESPACED_HOSTS = new Set(['dev.xmobile.com.tm']);

const COOKIE_NAMESPACE_SUFFIX = '_DEV';

/** Minimal shape shared by NextApiRequest, getServerSideProps' req, and the
 *  IncomingMessage the ws-server is handed. */
interface HostAwareRequest {
  headers: { [key: string]: string | string[] | undefined };
}

/**
 * The host a cookie is being read for: the request's on the server, the current
 * page's in the browser.
 */
function resolveHost(req?: HostAwareRequest): string | undefined {
  if (req) {
    const header = req.headers?.host;
    return Array.isArray(header) ? header[0] : header;
  }
  if (typeof window !== 'undefined') return window.location.host;
  return undefined;
}

export function cookieNamespaceSuffix(host?: string | null): string {
  if (!host) return '';
  // Both the Host header and location.host can carry a port.
  const hostname = host.split(':')[0].trim().toLowerCase();
  return NAMESPACED_HOSTS.has(hostname) ? COOKIE_NAMESPACE_SUFFIX : '';
}

/** The name new cookies are written under for this host. */
export function guestSessionCookieName(req?: HostAwareRequest): string {
  return `${GUEST_SESSION_COOKIE_NAME}${cookieNamespaceSuffix(resolveHost(req))}`;
}

export function authRefreshCookieName(req?: HostAwareRequest): string {
  return `${AUTH_REFRESH_COOKIE_NAME}${cookieNamespaceSuffix(resolveHost(req))}`;
}

/**
 * Every name a cookie may currently be stored under, most specific first.
 *
 * Reads accept the shared name as a fallback so this change rolls forward
 * safely: sessions issued before it, and the native wrapper -- which injects
 * the unsuffixed names from a shipped binary that cannot be redeployed in
 * lockstep with the server -- keep working.
 */
function candidateNames(baseName: string, req?: HostAwareRequest): string[] {
  const suffix = cookieNamespaceSuffix(resolveHost(req));
  return suffix ? [`${baseName}${suffix}`, baseName] : [baseName];
}

function readCookie(
  cookies: Partial<Record<string, string>> | undefined,
  baseName: string,
  req?: HostAwareRequest,
): string | undefined {
  if (!cookies) return undefined;
  return candidateNames(baseName, req)
    .map((name) => cookies[name])
    .find((value) => value != null);
}

export function readGuestSessionCookie(
  cookies: Partial<Record<string, string>> | undefined,
  req?: HostAwareRequest,
): string | undefined {
  return readCookie(cookies, GUEST_SESSION_COOKIE_NAME, req);
}

export function readAuthRefreshCookie(
  cookies: Partial<Record<string, string>> | undefined,
  req?: HostAwareRequest,
): string | undefined {
  return readCookie(cookies, AUTH_REFRESH_COOKIE_NAME, req);
}

/** Client-side read; `get` is injected so this module stays importable from the
 *  ws-server, which has no `document`. */
export function readAuthRefreshCookieWith(
  get: (name: string) => string | undefined,
): string | undefined {
  return candidateNames(AUTH_REFRESH_COOKIE_NAME)
    .map(get)
    .find((value) => value != null);
}

/** Every name the refresh cookie may be stored under, for clearing on sign-out. */
export function authRefreshCookieNames(req?: HostAwareRequest): string[] {
  return candidateNames(AUTH_REFRESH_COOKIE_NAME, req);
}

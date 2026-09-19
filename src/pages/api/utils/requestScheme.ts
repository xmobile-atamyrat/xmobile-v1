/**
 * Minimal shape shared by NextApiRequest and the IncomingMessage handed to
 * getServerSideProps, so both request styles can reuse this check.
 */
interface SchemeAwareRequest {
  headers: { [key: string]: string | string[] | undefined };
  // node's Socket vs TLSSocket: only the latter carries `encrypted`, so this
  // stays untyped here and is narrowed at the point of use.
  socket?: unknown;
}

/**
 * Whether the request actually arrived over HTTPS.
 *
 * Session cookies used to be marked `Secure` whenever NODE_ENV === 'production',
 * but a production build is also what runs on staging, which is served over
 * plain HTTP (see BASE_URL in src/lib/ApiEndpoints.ts). Browsers silently
 * discard `Secure` cookies on an insecure origin, so REFRESH_TOKEN and
 * GUEST_SESSION_ID were never stored there: every request minted a fresh guest
 * session, which made the guest cart look empty right after a successful add.
 *
 * Derive the flag from the request scheme instead of the build mode, so
 * production over TLS still gets `Secure` and staging over HTTP still works.
 */
export function isSecureRequest(req: SchemeAwareRequest): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;

  if (proto) {
    // A chain of proxies appends rather than replaces: "https,http".
    // The first hop is the one the browser actually spoke to.
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }

  // No proxy in front: TLS was terminated by Node itself.
  return (
    (req.socket as { encrypted?: boolean } | undefined)?.encrypted === true
  );
}

/** `Secure; ` or `` for interpolation into a Set-Cookie string. */
export function secureCookieAttr(req: SchemeAwareRequest): string {
  return isSecureRequest(req) ? 'Secure; ' : '';
}

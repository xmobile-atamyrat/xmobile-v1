/**
 * Settings for the MCP server (`/api/mcp`) and the OAuth server that guards it.
 * Everything is read per call rather than at import, so tests and a restart
 * with a changed `.env` see the current values.
 */

/** The kill switch: unless it is exactly "true", every MCP and OAuth route 404s. */
export function mcpEnabled(): boolean {
  return process.env.MCP_ENABLED === 'true';
}

/**
 * The site's public origin, e.g. `https://xmobile.com.tm`. It comes from the
 * environment and never from the request's Host header: the metadata
 * documents hand this URL to AI clients, and a spoofed Host must not be able
 * to point them somewhere else. Null when unset or not an https origin, which
 * keeps the whole server off.
 */
export function mcpPublicOrigin(): string | null {
  const raw = process.env.MCP_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The public origin while the server is switched on and fully configured,
 * null otherwise: one check that is both the kill switch and the origin.
 */
export function mcpOrigin(): string | null {
  return mcpEnabled() ? mcpPublicOrigin() : null;
}

export function mcpReady(): boolean {
  return mcpOrigin() != null;
}

export const MCP_PATH = '/api/mcp';

/** The resource identifier (RFC 8707) every access token is bound to. */
export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource${MCP_PATH}`;
}

export const MCP_SCOPE = 'catalog.images';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/** A grant ends this long after the admin approved it, however often it refreshes. */
export const GRANT_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
export const AUTH_CODE_TTL_SECONDS = 120;

/**
 * The callback hosts of the AI apps this server is used with: ChatGPT,
 * Claude and Gemini.
 */
export const DEFAULT_REDIRECT_HOSTS = [
  'chatgpt.com',
  'claude.ai',
  'oauth-redirect.googleusercontent.com',
];

/**
 * Hosts a client may redirect back to after login. Unset or blank means
 * `DEFAULT_REDIRECT_HOSTS`, so the empty line in `.env.example` doesn't lock
 * everyone out; set it to narrow the list, or to add a host for testing.
 */
export function allowedRedirectHosts(): string[] {
  const raw =
    process.env.MCP_ALLOWED_REDIRECT_HOSTS?.trim() ||
    DEFAULT_REDIRECT_HOSTS.join(',');
  return raw
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True for an https URL on an allowed host, with no credentials, port or
 * fragment. Checked when a client is created and again at every
 * authorization, so removing a host from the list also cuts off clients made
 * before.
 */
export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    url.hash === '' &&
    allowedRedirectHosts().includes(url.hostname.toLowerCase())
  );
}

/** The query parameters of an authorization request that this server reads. */
export const AUTHORIZE_PARAM_NAMES = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'scope',
  'resource',
] as const;

/** The hostname of a URL, or null when it isn't one. */
export function urlHost(raw: string | undefined): string | null {
  if (raw == null) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

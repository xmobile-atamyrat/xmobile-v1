import { beginOAuthRoute, field, sendOAuthError } from '@/lib/mcp/oauthHttp';
import {
  exchangeAuthorizationCode,
  OAuthError,
  refreshAccessToken,
} from '@/lib/mcp/oauthStore';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: { sizeLimit: '16kb' } },
};

/** `client_secret_basic`: `Authorization: Basic base64(id:secret)`. */
function basicCredentials(header: string | undefined): {
  clientId?: string;
  clientSecret?: string;
} {
  if (header == null || !header.startsWith('Basic ')) return {};
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon === -1) return {};
  try {
    return {
      clientId: decodeURIComponent(decoded.slice(0, colon)),
      clientSecret: decodeURIComponent(decoded.slice(colon + 1)),
    };
  } catch {
    return {};
  }
}

/** The token endpoint (RFC 6749 section 3.2): codes and refresh tokens in, tokens out. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const origin = beginOAuthRoute(req, res, 'POST');
  if (origin == null) return;
  res.setHeader('Pragma', 'no-cache');
  const body: unknown = req.body;
  const basic = basicCredentials(req.headers.authorization);
  const credentials = {
    clientId: basic.clientId ?? field(body, 'client_id'),
    clientSecret: basic.clientSecret ?? field(body, 'client_secret'),
  };
  try {
    const grantType = field(body, 'grant_type');
    if (grantType === 'authorization_code') {
      res.status(200).json(
        await exchangeAuthorizationCode(origin, {
          ...credentials,
          code: field(body, 'code'),
          redirectUri: field(body, 'redirect_uri'),
          codeVerifier: field(body, 'code_verifier'),
          resource: field(body, 'resource'),
        }),
      );
      return;
    }
    if (grantType === 'refresh_token') {
      res.status(200).json(
        await refreshAccessToken({
          ...credentials,
          refreshToken: field(body, 'refresh_token'),
        }),
      );
      return;
    }
    throw new OAuthError('unsupported_grant_type', 'Unsupported grant_type');
  } catch (error) {
    // RFC 6749 section 5.2: a 401 names the scheme the client can authenticate with.
    if (error instanceof OAuthError && error.status === 401) {
      res.setHeader('WWW-Authenticate', 'Basic realm="xmobile mcp"');
    }
    sendOAuthError(res, error);
  }
}

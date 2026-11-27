import {
  MCP_SCOPE,
  mcpOrigin,
  protectedResourceMetadataUrl,
} from '@/lib/mcp/config';
import { verifyAccessToken } from '@/lib/mcp/oauthStore';
import { overRateLimit } from '@/lib/mcp/rateLimit';
import {
  handleMessage,
  INVALID_REQUEST,
  rpcError,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@/lib/mcp/protocol';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: { sizeLimit: '100kb' } },
};

/**
 * The MCP endpoint (Streamable HTTP, stateless, JSON responses only).
 * Every request needs an access token from the OAuth flow, and the token's
 * superuser is re-checked against the database each time.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const origin = mcpOrigin();
  if (origin == null) {
    res.status(404).end();
    return;
  }
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    // No server-to-client stream (GET) and no sessions to end (DELETE).
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  // Browsers always send Origin; the AI platforms call from their servers and
  // don't. Refusing foreign origins keeps any web page, including one reached
  // through DNS rebinding, from driving this endpoint.
  const requestOrigin = req.headers.origin;
  if (requestOrigin != null && requestOrigin !== origin) {
    res.status(403).json({ error: 'forbidden_origin' });
    return;
  }

  // The scheme name is case-insensitive (RFC 7235 §2.1).
  const bearer = /^bearer +(\S+) *$/i.exec(req.headers.authorization ?? '');
  const token = bearer?.[1];
  const principal = await verifyAccessToken(token);
  if (principal == null) {
    const challenge = [
      `Bearer resource_metadata="${protectedResourceMetadataUrl(origin)}"`,
      `scope="${MCP_SCOPE}"`,
      ...(token != null ? ['error="invalid_token"'] : []),
    ].join(', ');
    res.setHeader('WWW-Authenticate', challenge);
    res
      .status(401)
      .json({ error: token != null ? 'invalid_token' : 'unauthorized' });
    return;
  }
  if (overRateLimit(principal.grantId)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const version = req.headers['mcp-protocol-version'];
  if (
    typeof version === 'string' &&
    !SUPPORTED_PROTOCOL_VERSIONS.includes(version)
  ) {
    res
      .status(400)
      .json(
        rpcError(null, INVALID_REQUEST, 'Unsupported MCP-Protocol-Version'),
      );
    return;
  }
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
    res.status(415).json(rpcError(null, INVALID_REQUEST, 'Expected JSON'));
    return;
  }
  if (Array.isArray(req.body)) {
    res
      .status(400)
      .json(
        rpcError(null, INVALID_REQUEST, 'Batch requests are not supported'),
      );
    return;
  }

  try {
    const reply = await handleMessage({ principal, origin, res }, req.body);
    if (reply == null) {
      res.status(202).end();
      return;
    }
    res.status(200).json(reply);
  } catch (error) {
    console.error('[mcp] request failed:', error);
    res.status(500).json(rpcError(null, -32603, 'Internal error'));
  }
}

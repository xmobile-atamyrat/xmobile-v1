import { beginOAuthRoute } from '@/lib/mcp/oauthHttp';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Dynamic Client Registration (RFC 7591), always refused. Gemini won't
 * connect unless the metadata names a registration endpoint (Google's MCP
 * OAuth guide), even when given a client ID and secret, so one is named. It
 * registers nothing: open registration would let anyone make a client and
 * send a superuser its consent link (see `src/lib/mcp/clients.ts`). Every AI
 * app gets its client ID and secret from `yarn mcp:create-client-*`.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (beginOAuthRoute(req, res, 'POST') == null) return;
  res.status(400).json({
    error: 'invalid_client_metadata',
    error_description:
      'Registration is closed. Enter the client ID and secret you were given for this server.',
  });
}

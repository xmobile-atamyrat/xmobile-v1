import { MCP_SCOPE } from '@/lib/mcp/config';
import { beginOAuthRoute } from '@/lib/mcp/oauthHttp';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * OAuth Authorization Server Metadata (RFC 8414), served at
 * `/.well-known/oauth-authorization-server` through a rewrite. Clients come
 * from `MCP_CLIENTS` (see `src/lib/mcp/clients.ts`), so AI apps ask for a
 * client ID and secret. The registration endpoint is there only because
 * Gemini needs one named, and refuses every registration.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = beginOAuthRoute(req, res, 'GET');
  if (origin == null) return;
  res.status(200).json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [
      'client_secret_post',
      'client_secret_basic',
    ],
    scopes_supported: [MCP_SCOPE],
    authorization_response_iss_parameter_supported: true,
  });
}

import { MCP_SCOPE, mcpResourceUrl } from '@/lib/mcp/config';
import { beginOAuthRoute } from '@/lib/mcp/oauthHttp';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * OAuth Protected Resource Metadata (RFC 9728), served at
 * `/.well-known/oauth-protected-resource[/api/mcp]` through a rewrite. It
 * tells an MCP client which authorization server issues tokens for /api/mcp.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = beginOAuthRoute(req, res, 'GET');
  if (origin == null) return;
  res.status(200).json({
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'xmobile',
  });
}

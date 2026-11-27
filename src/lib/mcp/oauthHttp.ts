import { mcpOrigin } from '@/lib/mcp/config';
import { OAuthError } from '@/lib/mcp/oauthStore';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Common start of every OAuth route: 404 while the MCP server is off,
 * the allowed method, and no caching. Returns the public origin, or null when
 * a response was already sent.
 */
export function beginOAuthRoute(
  req: NextApiRequest,
  res: NextApiResponse,
  method: 'GET' | 'POST',
): string | null {
  const origin = mcpOrigin();
  if (origin == null) {
    res.status(404).end();
    return null;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).end();
    return null;
  }
  return origin;
}

export function sendOAuthError(res: NextApiResponse, error: unknown): void {
  if (error instanceof OAuthError) {
    res
      .status(error.status)
      .json({ error: error.code, error_description: error.message });
    return;
  }
  console.error('[mcp oauth] failed:', error);
  res.status(500).json({ error: 'server_error' });
}

/** A single string field from a parsed form or JSON body. */
export function field(body: unknown, name: string): string | undefined {
  if (body == null || typeof body !== 'object') return undefined;
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length <= 4000 ? value : undefined;
}

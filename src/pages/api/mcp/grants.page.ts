import { mcpReady } from '@/lib/mcp/config';
import {
  listActiveGrants,
  revokeAllGrants,
  revokeGrant,
} from '@/lib/mcp/oauthStore';
import addCors from '@/pages/api/utils/addCors';
import { requireSuperuserBearerAuth } from '@/pages/api/utils/staffAuth';
import type { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Connected AI apps, for superusers: GET lists the grants not yet revoked or
 * run out (see `listActiveGrants` for `active`), DELETE
 * `?grantId=` disconnects one and DELETE `?all=true` disconnects every one.
 * A revoked grant stops working on its next request.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  res.setHeader('Cache-Control', 'no-store');
  // Listed and revocable even with MCP_ENABLED off: switching the server off
  // is no reason to lose sight of who was connected.
  const actor = await requireSuperuserBearerAuth(req, res);
  if (actor == null) return;
  if (req.method === 'GET') {
    res.status(200).json({
      success: true,
      message: mcpReady() ? 'enabled' : 'disabled',
      data: await listActiveGrants(),
    });
    return;
  }
  if (req.method === 'DELETE') {
    const { grantId, all } = req.query;
    if (all === 'true') {
      const count = await revokeAllGrants();
      res.status(200).json({ success: true, message: `${count} revoked` });
      return;
    }
    if (typeof grantId !== 'string' || grantId === '') {
      res.status(400).json({ success: false, message: 'grantId is required' });
      return;
    }
    const revoked = await revokeGrant(grantId);
    res
      .status(revoked ? 200 : 404)
      .json({ success: revoked, message: revoked ? 'revoked' : 'not found' });
    return;
  }
  res.setHeader('Allow', 'GET, DELETE');
  res.status(405).json({ success: false, message: 'Method not allowed' });
}

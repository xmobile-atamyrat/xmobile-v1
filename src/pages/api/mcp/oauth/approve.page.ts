import { AUTHORIZE_PARAM_NAMES } from '@/lib/mcp/config';
import { beginOAuthRoute, field, sendOAuthError } from '@/lib/mcp/oauthHttp';
import {
  approveAuthorization,
  AuthorizeParams,
  buildRedirect,
  OAuthError,
  validateAuthorizeRequest,
} from '@/lib/mcp/oauthStore';
import {
  requireSuperuserBearerAuth,
  requireUserBearerAuth,
} from '@/pages/api/utils/staffAuth';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: { sizeLimit: '16kb' } },
};

/**
 * The consent page's buttons. Both need the user's own session token in the
 * Authorization header, which a cross-site form or link can't attach, so
 * there is no CSRF to defend against: approving a superuser's, denying any
 * signed-in user's (the page offers it to one who isn't a superuser). Without
 * that, anyone could have this route sign an `access_denied` for any client
 * and `state`. Both re-check the whole request: nothing the page sends is
 * trusted. Answers `{ redirectTo }`, the client's callback with a code or an
 * error.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const origin = beginOAuthRoute(req, res, 'POST');
  if (origin == null) return;
  const params: AuthorizeParams = {};
  AUTHORIZE_PARAM_NAMES.forEach((name) => {
    const value = field(req.body, name);
    if (value != null) params[name] = value;
  });
  try {
    const request = await validateAuthorizeRequest(origin, params);
    const approving = field(req.body, 'decision') === 'approve';
    const actor = approving
      ? await requireSuperuserBearerAuth(req, res)
      : await requireUserBearerAuth(req, res);
    if (actor == null) return;
    if (actor.userId == null) {
      // A token whose userId isn't a string: nothing was sent yet.
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    res.status(200).json({
      redirectTo: approving
        ? approveAuthorization(
            origin,
            { ...actor, userId: actor.userId },
            request,
          )
        : buildRedirect(origin, request, { error: 'access_denied' }),
    });
  } catch (error) {
    // Found after the client's redirect checked out (say, the request changed
    // since the page was shown): back to the client, as the page itself would.
    if (error instanceof OAuthError && error.redirectTo != null) {
      res.status(200).json({ redirectTo: error.redirectTo });
      return;
    }
    sendOAuthError(res, error);
  }
}

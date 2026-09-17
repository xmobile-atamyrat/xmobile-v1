import {
  guestSessionCookieName,
  readGuestSessionCookie,
} from '@/pages/lib/cookieNames';
import { secureCookieAttr } from '@/pages/api/utils/requestScheme';
import { GUEST_SESSION_EXPIRY_COOKIE } from '@/pages/lib/constants';
import { NextApiRequest, NextApiResponse } from 'next';

function generateGuestSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateGuestSessionId(
  req: NextApiRequest,
  res: NextApiResponse,
): string {
  const existing = readGuestSessionCookie(req.cookies, req);
  if (existing) return existing;

  const cookieName = guestSessionCookieName(req);
  const guestSessionId = generateGuestSessionId();
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${guestSessionId}; HttpOnly; ${secureCookieAttr(req)}SameSite=Lax; Max-Age=${GUEST_SESSION_EXPIRY_COOKIE}; Path=/`,
  );
  req.cookies[cookieName] = guestSessionId;

  return guestSessionId;
}

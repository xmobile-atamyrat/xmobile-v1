import {
  GUEST_SESSION_COOKIE_NAME,
  GUEST_SESSION_EXPIRY_COOKIE,
} from '@/pages/lib/constants';
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
  const existing = req.cookies[GUEST_SESSION_COOKIE_NAME];
  if (existing) return existing;

  const guestSessionId = generateGuestSessionId();
  res.setHeader(
    'Set-Cookie',
    `${GUEST_SESSION_COOKIE_NAME}=${guestSessionId}; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${GUEST_SESSION_EXPIRY_COOKIE}; Path=/`,
  );
  req.cookies[GUEST_SESSION_COOKIE_NAME] = guestSessionId;

  return guestSessionId;
}

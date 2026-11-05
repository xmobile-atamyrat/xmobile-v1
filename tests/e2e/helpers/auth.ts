import { expect, type BrowserContext } from '@playwright/test';

import {
  E2E_PASSWORD,
  E2E_USERS,
  type E2eUserKey,
} from '../fixtures/procurement';

/**
 * Signs in a seeded user through the real `/api/user/signin`. The response's
 * REFRESH_TOKEN cookie lands in the context's cookie jar (context.request
 * shares it with the pages), and UserContext exchanges it for an access token
 * on the next page load — exactly what a real login leaves behind.
 */
export async function signInAs(
  context: BrowserContext,
  who: E2eUserKey,
): Promise<void> {
  const res = await context.request.post('/api/user/signin', {
    data: { email: E2E_USERS[who].email, password: E2E_PASSWORD },
  });
  expect(res.ok(), `sign-in as ${who}: ${await res.text()}`).toBe(true);
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === 'REFRESH_TOKEN')).toBe(true);
}

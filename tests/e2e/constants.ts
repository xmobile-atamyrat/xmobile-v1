/** Port for Next.js started by Playwright `webServer` (avoid clashing with local `yarn dev` on 3003). */
export const E2E_PORT = process.env.E2E_PORT ?? '3103';

export const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;

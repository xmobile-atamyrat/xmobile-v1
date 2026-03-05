/**
 * Shared Telekom API client for balance and related data.
 * Used by analytics page (admin UI) and batch-runner (daily balance alert).
 */

const TELEKOM_LOGIN_URL = 'https://os.telecom.tm:5000/api/v1/auth/login';
const TELEKOM_CLIENT_SELF_URL =
  'https://os.telecom.tm:5000/api/v1/clients/self';

export interface TelekomBalanceResult {
  balance: number;
}

/**
 * Fetches current Telekom account balance (TMT).
 * Requires TELEKOM_USERNAME and TELEKOM_PASSWORD env vars.
 * @returns Balance in TMT (floored integer), or null if credentials missing or request fails
 */
export async function fetchTelekomBalance(): Promise<number | null> {
  const username = process.env.TELEKOM_USERNAME;
  const password = process.env.TELEKOM_PASSWORD;

  if (username == null || password == null) {
    return null;
  }

  try {
    const loginResponse = await fetch(TELEKOM_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!loginResponse.ok) {
      throw new Error('Telekom login request failed');
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.result?.accessToken;
    if (!accessToken) {
      throw new Error('No access token in login response');
    }

    const clientResponse = await fetch(TELEKOM_CLIENT_SELF_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!clientResponse.ok) {
      throw new Error('Telekom client data request failed');
    }

    const clientData = await clientResponse.json();
    const balance = clientData.result?.client?.balance;
    if (typeof balance !== 'number') {
      throw new Error('Invalid balance in client response');
    }

    return Math.floor(balance);
  } catch (error) {
    console.error('[Telekom] fetchTelekomBalance failed:', error);
    throw error;
  }
}

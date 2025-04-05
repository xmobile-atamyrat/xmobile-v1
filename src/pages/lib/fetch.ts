import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';

export const fetchWithoutCreds = async (
  path: string,
  method: string,
  body?: object,
): Promise<ResponseApi> => {
  const data = await (
    await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? null : JSON.stringify(body),
    })
  ).json();
  return data;
};

export const fetchWithCreds = async (
  accessToken: string,
  path: string,
  method: string,
  body?: object,
): Promise<ResponseApi> => {
  const data = await (
    await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: method === 'GET' ? null : JSON.stringify(body),
      credentials: 'include',
    })
  ).json();
  return data;
};

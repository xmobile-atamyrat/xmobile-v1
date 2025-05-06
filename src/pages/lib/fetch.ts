import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';

export const fetchWithoutCreds = async <K>(
  path: string,
  method: string,
  body?: object,
): Promise<ResponseApi<K>> => {
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

export const fetchWithCreds = async <K>(
  accessToken: string,
  path: string,
  method: string,
  body?: object,
): Promise<ResponseApi<K>> => {
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

export function useFetchWithCreds() {
  const { setAccessToken } = useUserContext();
  return async <K>({
    accessToken,
    path,
    method,
    body,
  }: {
    accessToken: string;
    path: string;
    method: string;
    body?: object;
  }): Promise<ResponseApi<K>> => {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: method === 'GET' ? null : JSON.stringify(body),
      credentials: 'include',
    });
    const newAccessToken = response.headers.get('Authorization');
    if (newAccessToken) {
      setAccessToken(newAccessToken.replace('Bearer ', ''));
    }
    const data = await response.json();
    return data;
  };
}

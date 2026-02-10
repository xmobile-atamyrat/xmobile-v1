import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import { isWebView } from '@/pages/lib/serviceWorker';
import {
  ProtectedUser,
  ResponseApi,
  UserContextProps,
} from '@/pages/lib/types';
import { getCookie } from '@/pages/lib/utils';
import { User } from '@prisma/client';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => undefined,
  accessToken: undefined,
  setAccessToken: () => undefined,
  isLoading: true,
});

export const useUserContext = () => useContext(UserContext);

export default function UserContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<ProtectedUser>();
  const [accessToken, setAccessToken] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const wasLoggedIn = useRef<boolean>(false);

  useEffect(() => {
    if (getCookie(AUTH_REFRESH_COOKIE_NAME) != null) {
      (async () => {
        try {
          const {
            data: { accessToken: fetchedAccessToken, user: fetchedUser },
            success,
          }: ResponseApi<{ accessToken: string; user: User }> = await (
            await fetch('/api/user', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            })
          ).json();
          if (success) {
            setAccessToken(fetchedAccessToken);
            setUser(fetchedUser);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isWebView()) {
      const syncState = () => {
        const refreshToken = getCookie(AUTH_REFRESH_COOKIE_NAME);
        const nextLocale = getCookie('NEXT_LOCALE');

        if (user) {
          wasLoggedIn.current = true;
          (window as any).ReactNativeWebView?.postMessage(
            JSON.stringify({
              type: 'AUTH_STATE',
              payload: {
                REFRESH_TOKEN: refreshToken,
                NEXT_LOCALE: nextLocale,
              },
            }),
          );
        } else if (wasLoggedIn.current) {
          wasLoggedIn.current = false;
          (window as any).ReactNativeWebView?.postMessage(
            JSON.stringify({
              type: 'LOGOUT',
            }),
          );
        }
      };

      syncState();
      window.addEventListener('cookie-change', syncState);

      return () => {
        window.removeEventListener('cookie-change', syncState);
      };
    }
    return undefined;
  }, [user]);

  const userContextState = useMemo(() => {
    return {
      user,
      setUser,
      accessToken,
      setAccessToken,
      isLoading,
    } as UserContextProps;
  }, [user, setUser, accessToken, setAccessToken, isLoading]);
  return (
    <UserContext.Provider value={userContextState}>
      {children}
    </UserContext.Provider>
  );
}

import BASE_URL from '@/lib/ApiEndpoints';
import {
  ProtectedUser,
  ResponseApi,
  UserContextProps,
} from '@/pages/lib/types';
import { User } from '@prisma/client';
import { useRouter } from 'next/router';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => undefined,
  accessToken: undefined,
  setAccessToken: () => undefined,
});

export const useUserContext = () => useContext(UserContext);

export default function UserContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<ProtectedUser>();
  const [accessToken, setAccessToken] = useState<string>();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${BASE_URL}/api/auth`, {
          method: 'GET',
          credentials: 'include',
        });
        const {
          success,
          data,
          message,
        }: ResponseApi<{ user: User; accessToken: string }> = await resp.json();
        if (success && data != null) {
          setUser(data.user);
          setAccessToken(data.accessToken);
        } else if (resp.status === 401) {
          // Refresh token expired, send the user to login page
          console.info(message);
          router.push('/user/signin');
        } else {
          // don't do anything, user doesn't have an account
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  const userContextState = useMemo(() => {
    return {
      user,
      setUser,
      accessToken,
      setAccessToken,
    } as UserContextProps;
  }, [user, setUser, accessToken, setAccessToken]);
  return (
    <UserContext.Provider value={userContextState}>
      {children}
    </UserContext.Provider>
  );
}

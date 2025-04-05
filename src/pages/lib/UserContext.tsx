import { AUTH_REFRESH_COOKIE_NAME } from '@/pages/lib/constants';
import { ProtectedUser, UserContextProps } from '@/pages/lib/types';
import { getCookie } from '@/pages/lib/utils';
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

  useEffect(() => {
    if (getCookie(AUTH_REFRESH_COOKIE_NAME) != null) {
      (async () => {
        try {
          // fetch user data
        } catch (error) {
          console.error(error);
        }
      })();
    }
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

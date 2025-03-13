import { ProtectedUser, UserContextProps } from '@/pages/lib/types';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

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

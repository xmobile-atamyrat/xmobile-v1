import { ProtectedUser, UserContextProps } from '@/pages/lib/types';
// import { decodeToken } from '@/pages/lib/utils';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => undefined,
  authToken: undefined,
  setAccessToken: () => undefined,
});

export const useUserContext = () => useContext(UserContext);

export default function UserContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<ProtectedUser>();
  const [authToken, setAccessToken] = useState<string>();

  // useEffect(() => {

  //   const decodedUserToken = decodeToken(authToken);
  //   setUser(decodedUserToken);

  //   return () => {
      
  //   };
  // }, [authToken]);

  const userContextState = useMemo(() => {
    return {
      user,
      setUser,
      authToken,
      setAccessToken,
    } as UserContextProps;
  }, [user, setUser, authToken, setAccessToken]);
  return (
    <UserContext.Provider value={userContextState}>
      {children}
    </UserContext.Provider>
  );
}

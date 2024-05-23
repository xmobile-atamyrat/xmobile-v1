import { UserContextProps } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => undefined,
});

export const useUserContext = () => useContext(UserContext);

export default function UserContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User>();
  const userContextState = useMemo(() => {
    return {
      user,
      setUser,
    } as UserContextProps;
  }, [user, setUser]);
  return (
    <UserContext.Provider value={userContextState}>
      {children}
    </UserContext.Provider>
  );
}

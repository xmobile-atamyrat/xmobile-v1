import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface CartContextProps {
  cartCount: number;
  setCartCount: Dispatch<SetStateAction<number>>;
  refreshCartCount: () => Promise<void>;
}

const CartContext = createContext<CartContextProps>({
  cartCount: 0,
  setCartCount: () => undefined,
  refreshCartCount: async () => {},
});

export const useCartContext = () => useContext(CartContext);

export default function CartContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, accessToken, isLoading, initialCartCount } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [cartCount, setCartCount] = useState(0);
  const latestRequestRef = useRef(0);
  const userId = user?.id;
  // Read at call time: sign-in calls refresh from a closure captured before
  // the user was set, right after the guest cart migrates.
  const authRef = useRef({ isLoading, userId, accessToken });
  authRef.current = { isLoading, userId, accessToken };

  const refreshCartCount = useCallback(async () => {
    const auth = authRef.current;
    if (auth.isLoading) return;
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;
    try {
      const { success, data } =
        auth.userId && auth.accessToken
          ? await fetchWithCreds<{ count: number }>({
              accessToken: auth.accessToken,
              path: '/api/cart?count=1',
              method: 'GET',
            })
          : await fetchWithoutCreds<{ count: number }>(
              '/api/guest/cart?count=1',
              'GET',
            );
      if (success && requestId === latestRequestRef.current) {
        setCartCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch cart count:', error);
    }
  }, [fetchWithCreds]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      if (userId && initialCartCount != null) setCartCount(initialCartCount);
      else refreshCartCount();
      return;
    }
    // Sign-in pages refresh themselves once the guest cart has migrated
    if (!userId) refreshCartCount();
  }, [isLoading, userId, initialCartCount, refreshCartCount]);

  const value = useMemo(
    () => ({ cartCount, setCartCount, refreshCartCount }),
    [cartCount, refreshCartCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

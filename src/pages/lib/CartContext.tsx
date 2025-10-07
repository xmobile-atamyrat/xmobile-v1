import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { CartItem, Product } from '@prisma/client';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface CartState {
  cartItems: (CartItem & { product: Product })[];
}

type CartResult =
  | { status: 'success'; messageKey: string }
  | { status: 'error'; messageKey: string }
  | { status: 'warning'; messageKey: string };

interface CartActions {
  fetchCartItems: () => Promise<void>;
  addCartItems: (productId: string, quantity?: number) => Promise<CartResult>;
  deleteCartItems: (cartItemId: string) => Promise<CartResult>;
}

const CartStateContext = createContext<CartState | undefined>(undefined);
const CartActionsContext = createContext<CartActions | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [cartItems, setCartItems] = useState<
    (CartItem & { product: Product })[]
  >([]);

  const fetchCartItems = useCallback(async () => {
    if (!user) return;
    try {
      const { success, data } = await fetchWithCreds<
        (CartItem & { product: Product })[]
      >({ accessToken, path: `/api/cart?userId=${user.id}`, method: 'GET' });

      if (success) setCartItems(data);
    } catch (err) {
      console.error(err);
    }
  }, [user, accessToken, fetchWithCreds]);

  const addCartItems = useCallback(
    async (productId: string, quantity = 1): Promise<CartResult> => {
      if (!user) return { status: 'warning', messageKey: 'userNotFound' };
      try {
        const { success } = await fetchWithCreds({
          accessToken,
          path: '/api/cart',
          method: 'POST',
          body: { userId: user.id, productId, quantity },
        });
        if (success) {
          await fetchCartItems();
          return { status: 'success', messageKey: 'addToCartSuccess' };
        }
        return { status: 'error', messageKey: 'addToCartFail' };
      } catch (err) {
        console.error(err);
        return { status: 'error', messageKey: 'genericError' };
      }
    },
    [user, accessToken, fetchWithCreds, fetchCartItems],
  );

  const deleteCartItems = useCallback(
    async (cartItemId: string): Promise<CartResult> => {
      try {
        const { success } = await fetchWithCreds({
          accessToken,
          path: '/api/cart',
          method: 'DELETE',
          body: { id: cartItemId },
        });
        if (success) {
          await fetchCartItems();
          return { status: 'success', messageKey: 'deleteFromCartSuccess' };
        }
        return { status: 'error', messageKey: 'deleteFromCartFail' };
      } catch (err) {
        console.error(err);
        return { status: 'error', messageKey: 'genericError' };
      }
    },
    [accessToken, fetchWithCreds, fetchCartItems],
  );

  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  const stateValue = useMemo(() => ({ cartItems }), [cartItems]);
  const actionsValue = useMemo(
    () => ({ fetchCartItems, addCartItems, deleteCartItems }),
    [fetchCartItems, addCartItems, deleteCartItems],
  );

  return (
    <CartStateContext.Provider value={stateValue}>
      <CartActionsContext.Provider value={actionsValue}>
        {children}
      </CartActionsContext.Provider>
    </CartStateContext.Provider>
  );
};

export const useCartState = () => {
  return useContext(CartStateContext);
};

export const useCartActions = () => {
  return useContext(CartActionsContext);
};

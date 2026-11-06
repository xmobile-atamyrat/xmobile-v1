import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  createContext,
  ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface FavoritesContextProps {
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextProps>({
  isFavorite: () => false,
  toggleFavorite: async () => {},
});

export const useFavoritesContext = () => useContext(FavoritesContext);

export default function FavoritesContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, accessToken, isLoading, initialFavoriteIds } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const userId = user?.id;
  const loadedRef = useRef(false);
  const savingRef = useRef(new Set<string>());
  // Read at call time: the token is set in the same update as the user, and
  // refreshing it must not refetch the list.
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  // Runs while the page may still be hydrating, and an urgent context change
  // above a next/dynamic boundary throws there. Hence the transition, and
  // keeping the old set so a guest's load changes nothing at all.
  const replaceFavorites = useCallback((ids: string[]) => {
    startTransition(() => {
      setFavoriteIds((prev) =>
        prev.size === 0 && ids.length === 0 ? prev : new Set(ids),
      );
    });
  }, []);

  useEffect(() => {
    if (isLoading) return undefined;
    const isFirstLoad = !loadedRef.current;
    loadedRef.current = true;

    if (!userId) {
      replaceFavorites([]);
      return undefined;
    }
    // The session's ids belong to whoever was signed in at page load, so a
    // later sign-in has to fetch its own: sign-in responses carry none.
    if (isFirstLoad && initialFavoriteIds != null) {
      replaceFavorites(initialFavoriteIds);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { success, data } = await fetchWithCreds<string[]>({
          accessToken: accessTokenRef.current,
          path: '/api/favorites?ids=1',
          method: 'GET',
        });
        if (success && !cancelled) replaceFavorites(data);
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, userId, initialFavoriteIds, fetchWithCreds, replaceFavorites]);

  const setFavorite = useCallback((productId: string, favorite: boolean) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (favorite) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (savingRef.current.has(productId)) return;
      savingRef.current.add(productId);
      const wasFavorite = favoriteIds.has(productId);
      setFavorite(productId, !wasFavorite);
      try {
        const { success, message } = await fetchWithCreds({
          accessToken: accessTokenRef.current,
          path: '/api/favorites',
          method: wasFavorite ? 'DELETE' : 'POST',
          body: { productId },
        });
        if (!success) throw new Error(message);
      } catch (error) {
        console.error('Failed to update favorite:', error);
        setFavorite(productId, wasFavorite);
      } finally {
        savingRef.current.delete(productId);
      }
    },
    [favoriteIds, fetchWithCreds, setFavorite],
  );

  const value = useMemo(
    () => ({
      isFavorite: (productId: string) => favoriteIds.has(productId),
      toggleFavorite,
    }),
    [favoriteIds, toggleFavorite],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

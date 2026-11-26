import type { StaleProduct } from '@/lib/priceStaleness';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { useRouter } from 'next/router';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// Stale-price warnings for staff, fetched once and shared by every product
// card and red dot. Customers never trigger the request.

// A page change re-reads the list when it is older than this, so an admin who
// leaves a tab open still sees today's state without a request per page.
const MAX_AGE_MS = 5 * 60 * 1000;

type StalePricesContextProps = {
  staleByProductId: Record<string, StaleProduct>;
  staleCount: number;
  /** Re-reads the list now, e.g. after prices were saved. */
  refresh: () => void;
};

const StalePricesContext = createContext<StalePricesContextProps>({
  staleByProductId: {},
  staleCount: 0,
  refresh: () => undefined,
});

export const useStalePrices = () => useContext(StalePricesContext);

export default function StalePricesContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const router = useRouter();
  const [staleByProductId, setStaleByProductId] = useState<
    Record<string, StaleProduct>
  >({});
  const fetchedAtRef = useRef(0);
  const isStaff = user?.grade === 'ADMIN' || user?.grade === 'SUPERUSER';
  // The token rotates on any authenticated response; reading it through a ref
  // keeps a rotation from counting as a reason to refetch.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const hasToken = Boolean(accessToken);

  const load = useCallback(async () => {
    const token = tokenRef.current;
    if (token == null) return;
    fetchedAtRef.current = Date.now();
    try {
      const { success, data } = await fetchWithCreds<
        Record<string, StaleProduct>
      >({ accessToken: token, path: '/api/prices/stale', method: 'GET' });
      if (success && data != null) setStaleByProductId(data);
    } catch (error) {
      // Best-effort: a failed read just leaves the previous warnings showing.
      console.error(error);
    }
  }, [fetchWithCreds]);

  useEffect(() => {
    if (isStaff && hasToken) {
      load();
    } else {
      // Signed out or not staff: drop whatever a previous admin session saw.
      fetchedAtRef.current = 0;
      setStaleByProductId({});
    }
  }, [isStaff, hasToken, user?.id, load]);

  useEffect(() => {
    if (!isStaff) return () => undefined;
    const onRouteChange = () => {
      if (Date.now() - fetchedAtRef.current > MAX_AGE_MS) load();
    };
    router.events?.on('routeChangeComplete', onRouteChange);
    return () => router.events?.off('routeChangeComplete', onRouteChange);
  }, [isStaff, router.events, load]);

  const refresh = useCallback(() => {
    if (isStaff) load();
  }, [isStaff, load]);

  const value = useMemo(
    () => ({
      staleByProductId,
      staleCount: Object.keys(staleByProductId).length,
      refresh,
    }),
    [staleByProductId, refresh],
  );

  return (
    <StalePricesContext.Provider value={value}>
      {children}
    </StalePricesContext.Provider>
  );
}

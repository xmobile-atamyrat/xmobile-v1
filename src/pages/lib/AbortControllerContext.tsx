import { AbortControllerContextProp } from '@/pages/lib/types';
import { useRouter } from 'next/router';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';

const AbortControllerContext = createContext<AbortControllerContextProp>({
  abortControllersRef: { current: new Set() },
  createAbortController: () => undefined,
  clearAbortController: () => undefined,
  clearAllAborts: () => undefined,
});

export const useAbortControllerContext = () =>
  useContext(AbortControllerContext);

export default function AbortControllerContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

  const createAbortController = useCallback(() => {
    const controller = new AbortController();
    abortControllersRef.current.add(controller);

    return controller;
  }, []);

  const clearAllAborts = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    abortControllersRef.current.clear();
  }, []);

  const clearAbortController = useCallback((controller: AbortController) => {
    abortControllersRef.current.delete(controller);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      clearAllAborts();
    };
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router.events, clearAllAborts]);

  const value = useMemo(
    () => ({
      abortControllersRef,
      createAbortController,
      clearAllAborts,
      clearAbortController,
    }),
    [createAbortController, clearAllAborts, clearAbortController],
  );

  return (
    <AbortControllerContext.Provider value={value}>
      {children}
    </AbortControllerContext.Provider>
  );
}

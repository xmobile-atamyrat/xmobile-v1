import BASE_URL from '@/lib/ApiEndpoints';
import { NavigatorExtended, NetworkContextProps } from '@/pages/lib/types';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const NetworkContext = createContext<NetworkContextProps>({
  network: 'unknown',
  setNetwork: () => undefined,
});

export const useNetworkContext = () => useContext(NetworkContext);

/**
 * Test network speed by downloading a small resource
 * Returns 'slow' if download takes longer than threshold, 'fast' otherwise
 */
async function testNetworkSpeed(): Promise<'slow' | 'fast'> {
  // For actual network test, we'll use a lightweight ping endpoint
  // Fallback to fast if test fails (better UX than blocking)
  try {
    const startTime = performance.now();

    // Use the ping endpoint for a lightweight speed test
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(`${BASE_URL}/api/ping`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        // If it takes more than 1 second, consider it slow
        // This is a heuristic - adjust based on your needs
        return duration > 1000 ? 'slow' : 'fast';
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // If fetch fails or times out, default to fast (better UX)
      return 'fast';
    }

    return 'fast';
  } catch (error) {
    // Default to fast on any error (better UX than blocking images)
    console.warn('Network speed test failed, defaulting to fast:', error);
    return 'fast';
  }
}

/**
 * Detect network speed using available browser APIs
 * Works across Chrome, Safari, Firefox, Yandex, and Edge
 */
async function detectNetworkSpeed(): Promise<'slow' | 'fast' | 'unknown'> {
  // Method 1: Use Network Information API (Chrome, Edge, Yandex - Chromium-based)
  const connection =
    (navigator as NavigatorExtended).connection ||
    (navigator as any).mozConnection || // Firefox (deprecated but might exist)
    (navigator as any).webkitConnection; // Safari (if available)

  if (connection && connection.effectiveType) {
    const effectiveType = connection.effectiveType.toLowerCase();
    if (effectiveType.includes('2g') || effectiveType.includes('3g')) {
      return 'slow';
    }
    if (effectiveType.includes('4g')) {
      // 4g is fast, slow-2g is slow
      return 'fast';
    }
    // For other types, fall through to speed test
  }

  // Method 2: Check if offline
  if (!navigator.onLine) {
    return 'unknown';
  }

  // Method 3: Perform speed test (for Safari, Firefox, and as fallback)
  return testNetworkSpeed();
}

export default function NetworkContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [network, setNetwork] =
    useState<NetworkContextProps['network']>('unknown');

  const NetworkContextState = useMemo(() => {
    return {
      network,
      setNetwork,
    };
  }, [network, setNetwork]);

  useEffect(() => {
    let isMounted = true;

    // Initial detection
    const detectNetwork = async () => {
      const detectedNetwork = await detectNetworkSpeed();
      if (isMounted) {
        setNetwork(detectedNetwork);
      }
    };

    detectNetwork();

    // Listen for Network Information API changes (Chrome, Edge, Yandex)
    const connection =
      (navigator as NavigatorExtended).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const handleNetworkChange = async () => {
      if (connection && connection.effectiveType) {
        const effectiveType = connection.effectiveType.toLowerCase();
        if (isMounted) {
          setNetwork(
            effectiveType.includes('2g') || effectiveType.includes('3g')
              ? 'slow'
              : 'fast',
          );
        }
      } else {
        // Re-run detection if connection API changes but doesn't have effectiveType
        await detectNetwork();
      }
    };

    if (connection) {
      // Use addEventListener if available (preferred)
      if (connection.addEventListener) {
        connection.addEventListener('change', handleNetworkChange);
      } else if (connection.onchange != null) {
        // Fallback to onchange property
        connection.onchange = handleNetworkChange;
      }
    }

    // Listen for online/offline events (all browsers)
    const handleOnline = async () => {
      await detectNetwork();
    };

    const handleOffline = () => {
      if (isMounted) {
        setNetwork('unknown');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      isMounted = false;
      if (connection) {
        if (connection.removeEventListener) {
          connection.removeEventListener('change', handleNetworkChange);
        }
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={NetworkContextState}>
      {children}
    </NetworkContext.Provider>
  );
}

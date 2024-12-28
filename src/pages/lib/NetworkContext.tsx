import { NavigatorExtended, NetworkContextProps } from '@/pages/lib/types';
import { createContext, ReactNode, useEffect, useMemo, useState } from 'react';

const NetworkContext = createContext<NetworkContextProps>({
  network: 'unknown',
  setNetwork: () => undefined,
});

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
    const handleNetworkChange = () => {
      const connection = (navigator as NavigatorExtended).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        setNetwork(
          effectiveType.includes('2g') || effectiveType.includes('3g')
            ? 'slow'
            : 'fast',
        );
      }
    };

    const connection = (navigator as NavigatorExtended).connection;
    if (connection) {
      connection.onchange = handleNetworkChange;
      handleNetworkChange();
    }
  }, []);

  return (
    <NetworkContext.Provider value={NetworkContextState}>
      {children}
    </NetworkContext.Provider>
  );
}

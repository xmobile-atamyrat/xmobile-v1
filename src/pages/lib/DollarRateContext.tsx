import { useFetchWithCreds } from '@/pages/lib/fetch';
import { DollarRateContextProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { DollarRate } from '@prisma/client';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const DollarRateContext = createContext<DollarRateContextProps>({
  rates: [],
  setRates: () => undefined,
});

export const useDollarRateContext = () => useContext(DollarRateContext);

export default function DollarRateContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [rates, setRates] = useState<DollarRate[]>([]);
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const dollarRateContextState = useMemo(() => {
    return {
      rates,
      setRates,
    };
  }, [rates, setRates]);

  useEffect(() => {
    (async () => {
      const resp = await fetchWithCreds<DollarRate[]>({
        accessToken,
        path: '/api/prices/rate',
        method: 'GET',
      });
      if (resp.success && resp.data != null) {
        setRates(resp.data);
      }
    })();
  }, []);

  return (
    <DollarRateContext.Provider value={dollarRateContextState}>
      {children}
    </DollarRateContext.Provider>
  );
}

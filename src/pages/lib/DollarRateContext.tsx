import { useFetchWithCreds } from '@/pages/lib/fetch';
import { DollarRateContextProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { CURRENCY, DollarRate } from '@prisma/client';
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

// The USD -> TMT rate, or undefined until the rates request resolves. Prices are
// stored in manat, so this is what the storefront divides by to show a product's
// USD equivalent without an extra request per product.
export const useTmtRate = (): number | undefined => {
  const { rates } = useDollarRateContext();
  return rates.find(({ currency }) => currency === CURRENCY.TMT)?.rate;
};

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

import BASE_URL from '@/lib/ApiEndpoints';
import { DollarRateProps } from '@/pages/lib/types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DollarRateContext = createContext<DollarRateProps>({
  rate: 0,
  setRate: () => undefined,
});

export const useDollarRateContext = () => useContext(DollarRateContext);

export default function DollarRateContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rate, setRate] = useState(0);
  const dollarRateState = useMemo(() => {
    return {
      rate,
      setRate,
    } as DollarRateProps;
  }, [rate, setRate]);

  useEffect(() => {
    const fetchDollarRate = async () => {
      try {
        const response = await (
          await fetch(`${BASE_URL}/api/prices/rate`)
        ).json();
        if (response.success && response.data != null) {
          setRate(response.data.rate);
        } else {
          console.error('Error fetching dollar rate', response);
        }
      } catch (error) {
        console.error('Error fetching dollar rate', error);
      }
    };

    fetchDollarRate();

    const intervalId = setInterval(fetchDollarRate, 600_000); // Poll every 10 minutes

    return () => clearInterval(intervalId);
  }, []);
  return (
    <DollarRateContext.Provider value={dollarRateState}>
      {children}
    </DollarRateContext.Provider>
  );
}

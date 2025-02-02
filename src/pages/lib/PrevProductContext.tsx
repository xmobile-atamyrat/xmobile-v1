import { PrevProductContextProps } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

const PrevProductContext = createContext<PrevProductContextProps>({
  prevProducts: [],
  setPrevProducts: () => undefined,
  prevSearchKeyword: undefined,
  setPrevSearchKeyword: () => undefined,
  prevCategory: undefined,
  setPrevCategory: () => undefined,
  prevPage: undefined,
  setPrevPage: () => undefined,
});

export const usePrevProductContext = () => useContext(PrevProductContext);

export default function PrevProductContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [prevProducts, setPrevProducts] = useState<Product[]>([]);
  const [prevSearchKeyword, setPrevSearchKeyword] = useState<
    string | undefined
  >();
  const [prevCategory, setPrevCategory] = useState<string | undefined>();
  const [prevPage, setPrevPage] = useState<number | undefined>(0);

  const PrevProductContextState = useMemo(() => {
    return {
      prevProducts,
      setPrevProducts,
      prevSearchKeyword,
      setPrevSearchKeyword,
      prevCategory,
      setPrevCategory,
      prevPage,
      setPrevPage,
    };
  }, [
    prevProducts,
    setPrevProducts,
    prevSearchKeyword,
    setPrevSearchKeyword,
    prevCategory,
    setPrevCategory,
    prevPage,
    setPrevPage,
  ]);

  return (
    <PrevProductContext.Provider value={PrevProductContextState}>
      {children}
    </PrevProductContext.Provider>
  );
}

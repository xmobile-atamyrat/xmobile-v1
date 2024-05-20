import { ProductContextProps } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

const ProductContext = createContext<ProductContextProps>({
  products: [],
  setProducts: () => undefined,
});

export const useProductContext = () => useContext(ProductContext);

export default function ProductContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const ProductContextState = useMemo(() => {
    return {
      products,
      setProducts,
    };
  }, [products, setProducts]);
  return (
    <ProductContext.Provider value={ProductContextState}>
      {children}
    </ProductContext.Provider>
  );
}

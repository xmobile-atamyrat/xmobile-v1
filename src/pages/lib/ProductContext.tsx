import { ProductContextProps } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

const ProductContext = createContext<ProductContextProps>({
  products: [],
  setProducts: () => undefined,
  selectedProduct: undefined,
  setSelectedProduct: () => undefined,
  searchKeyword: undefined,
  setSearchKeyword: () => undefined,
});

export const useProductContext = () => useContext(ProductContext);

export default function ProductContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [searchKeyword, setSearchKeyword] = useState<string | undefined>();

  const ProductContextState = useMemo(() => {
    return {
      products,
      setProducts,
      selectedProduct,
      setSelectedProduct,
      searchKeyword,
      setSearchKeyword,
    };
  }, [
    products,
    setProducts,
    selectedProduct,
    setSelectedProduct,
    searchKeyword,
    setSearchKeyword,
  ]);
  return (
    <ProductContext.Provider value={ProductContextState}>
      {children}
    </ProductContext.Provider>
  );
}

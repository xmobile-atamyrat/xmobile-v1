import { fetchColors } from '@/pages/lib/apis';
import { ProductContextProps } from '@/pages/lib/types';
import { Color, Product } from '@prisma/client';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const ProductContext = createContext<ProductContextProps>({
  products: [],
  setProducts: () => undefined,
  selectedProduct: undefined,
  setSelectedProduct: () => undefined,
  searchKeyword: undefined,
  setSearchKeyword: () => undefined,
  colorsMap: new Map(),
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
  const [colorsMap, setColorsMap] = useState<Map<string, Color>>(new Map());

  // Fetched once app-wide so any product card can resolve a variant tag's
  // {colorId} to a name/hex without a per-card network call.
  useEffect(() => {
    (async () => {
      const colors = await fetchColors();
      setColorsMap(new Map(colors.map((c) => [c.id, c])));
    })();
  }, []);

  const ProductContextState = useMemo(() => {
    return {
      products,
      setProducts,
      selectedProduct,
      setSelectedProduct,
      searchKeyword,
      setSearchKeyword,
      colorsMap,
    };
  }, [
    products,
    setProducts,
    selectedProduct,
    setSelectedProduct,
    searchKeyword,
    setSearchKeyword,
    colorsMap,
  ]);
  return (
    <ProductContext.Provider value={ProductContextState}>
      {children}
    </ProductContext.Provider>
  );
}

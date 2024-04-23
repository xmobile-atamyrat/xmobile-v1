import { CategoryContextProps, ExtendedCategory } from '@/pages/lib/types';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

const CategoryContext = createContext<CategoryContextProps>({
  categories: [],
  setCategories: () => undefined,
});

export const useCategoryContext = () => useContext(CategoryContext);

export default function CategoryContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const categoryContextState = useMemo(() => {
    return {
      categories,
      setCategories,
    };
  }, [categories, setCategories]);
  return (
    <CategoryContext.Provider value={categoryContextState}>
      {children}
    </CategoryContext.Provider>
  );
}

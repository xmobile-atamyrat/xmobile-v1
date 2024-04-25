import { CategoryContextProps, ExtendedCategory } from '@/pages/lib/types';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

const CategoryContext = createContext<CategoryContextProps>({
  categories: [],
  setCategories: () => undefined,
  selectedCategoryId: undefined,
  setSelectedCategoryId: () => undefined,
});

export const useCategoryContext = () => useContext(CategoryContext);

export default function CategoryContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const categoryContextState = useMemo(() => {
    return {
      categories,
      setCategories,
      selectedCategoryId,
      setSelectedCategoryId,
    };
  }, [categories, setCategories, selectedCategoryId, setSelectedCategoryId]);
  return (
    <CategoryContext.Provider value={categoryContextState}>
      {children}
    </CategoryContext.Provider>
  );
}

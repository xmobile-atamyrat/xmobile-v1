import { fetchCategories } from '@/pages/lib/apis';
import { CategoryContextProps, ExtendedCategory } from '@/pages/lib/types';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

  useEffect(() => {
    (async () => {
      try {
        const { success, data, message } = await fetchCategories();
        if (success && data != null) {
          setCategories(data);
        } else {
          console.error(message);
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  return (
    <CategoryContext.Provider value={categoryContextState}>
      {children}
    </CategoryContext.Provider>
  );
}

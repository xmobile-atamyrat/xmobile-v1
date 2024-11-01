import BASE_URL from '@/lib/ApiEndpoints';
import {
  CategoryContextProps,
  CategoryStack,
  ExtendedCategory,
  ResponseApi,
} from '@/pages/lib/types';
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
  stack: [],
  setStack: () => undefined,
  parentCategory: undefined,
  setParentCategory: () => undefined,
});

export const useCategoryContext = () => useContext(CategoryContext);

export default function CategoryContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [stack, setStack] = useState<CategoryStack>([]);
  const [parentCategory, setParentCategory] = useState<ExtendedCategory>();

  const categoryContextState = useMemo(() => {
    return {
      categories,
      setCategories,
      selectedCategoryId,
      setSelectedCategoryId,
      stack,
      setStack,
      parentCategory,
      setParentCategory,
    };
  }, [
    categories,
    setCategories,
    selectedCategoryId,
    setSelectedCategoryId,
    stack,
    setStack,
    parentCategory,
    setParentCategory,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const { success, data, message }: ResponseApi<ExtendedCategory[]> =
          await (await fetch(`${BASE_URL}/api/category`)).json();
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

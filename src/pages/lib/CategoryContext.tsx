import BASE_URL from '@/lib/ApiEndpoints';
import {
  CategoryContextProps,
  CategoryLayers,
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
  categoryLayers: [],
  setCategoryLayers: () => undefined,
});

export const useCategoryContext = () => useContext(CategoryContext);

function constructCategoryLayers(
  categoryLayers: CategoryLayers,
  layer: number,
  categories?: ExtendedCategory[],
) {
  if (categories == null || categories.length === 0) return;
  categories.forEach((category) => {
    if (categoryLayers[layer] == null) {
      categoryLayers[layer] = [];
    }
    categoryLayers[layer].push(category);
    constructCategoryLayers(
      categoryLayers,
      layer + 1,
      category.successorCategories,
    );
  });
}

export default function CategoryContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [categoryLayers, setCategoryLayers] = useState<CategoryLayers>({});

  const categoryContextState = useMemo(() => {
    return {
      categories,
      setCategories,
      selectedCategoryId,
      setSelectedCategoryId,
      categoryLayers,
      setCategoryLayers,
    };
  }, [
    categories,
    setCategories,
    selectedCategoryId,
    setSelectedCategoryId,
    categoryLayers,
    setCategoryLayers,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const { success, data, message }: ResponseApi<ExtendedCategory[]> =
          await (await fetch(`${BASE_URL}/api/category`)).json();
        if (success && data != null) {
          setCategories(data);

          const initialCategoryLayers = {};
          constructCategoryLayers(initialCategoryLayers, 0, data);
          setCategoryLayers(initialCategoryLayers);
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

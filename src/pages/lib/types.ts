import { Category, Product, User } from '@prisma/client';
import { Dispatch, SetStateAction } from 'react';

export interface ResponseApi<K = any> {
  success: boolean;
  data?: K;
  message?: string;
}

export interface ExtendedCategory extends Category {
  products?: Product[];
  successorCategories?: Category[];
}

export interface CategoryContextProps {
  categories: ExtendedCategory[];
  setCategories: Dispatch<SetStateAction<ExtendedCategory[]>>;
  selectedCategoryId?: string;
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>;
}

export interface UserContextProps {
  user?: User;
  setUser: Dispatch<SetStateAction<User>>;
}

export interface EditCategoriesProps {
  open: boolean;
  dialogType?: 'add' | 'edit';
  categoryId?: string;
  categoryName?: string;
}

export interface DeleteCategoriesProps {
  categoryId?: string;
  open: boolean;
  imgUrl?: string | null;
}

export interface ProductContextProps {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
}

export interface CategoryName {
  en: string;
  ru: string;
  tk: string;
  ch: string;
}

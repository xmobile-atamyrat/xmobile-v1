import { Category, Product } from '@prisma/client';
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
}

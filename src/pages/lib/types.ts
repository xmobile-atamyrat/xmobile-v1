import { Category, Product } from '@prisma/client';

export interface ResponseApi<K = any> {
  success: boolean;
  data?: K;
  message?: string;
}

export interface ExtendedCategory extends Category {
  products?: Product[];
  successorCategories?: Category[];
}

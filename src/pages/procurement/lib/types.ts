import {
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';

export interface DetailedOrder extends ProcurementOrder {
  suppliers: ProcurementSupplier[];
  products: ProcurementProduct[];
  prices: ProcurementSupplierProductPrice[];
  quantities: ProcurementOrderProductQuantity[];
}

export type HistoryColor = 'red' | 'green' | 'orange';

export interface HistoryPrice {
  value: number;
  color?: HistoryColor;
}

export type ProductsSuppliersType = 'product' | 'supplier';

export type ProductsSuppliersActionsType = 'existing' | 'added' | 'deleted';

export type ActionBasedSuppliers = Record<
  ProductsSuppliersActionsType,
  ProcurementSupplier[]
>;

export type ActionBasedProducts = Record<
  ProductsSuppliersActionsType,
  ProcurementProduct[]
>;

import {
  ProcurementOrder,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';

export interface DetailedHistory extends ProcurementOrder {
  suppliers: ProcurementSupplier[];
  procurementProducts: ProcurementProduct[];
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

import {
  CalculationHistory,
  ProcurementProduct,
  Supplier,
} from '@prisma/client';

export interface DetailedHistory extends CalculationHistory {
  suppliers: Supplier[];
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
  Supplier[]
>;

export type ActionBasedProducts = Record<
  ProductsSuppliersActionsType,
  ProcurementProduct[]
>;

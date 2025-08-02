import {
  OrderPriceColor,
  ProcurementOrder,
  ProcurementOrderProduct,
  ProcurementOrderProductQuantity,
  ProcurementOrderSupplier,
  ProcurementProduct,
  ProcurementSupplier,
  ProcurementSupplierProductPrice,
} from '@prisma/client';

export interface DetailedOrderProduct extends ProcurementOrderProduct {
  product: ProcurementProduct;
  order: ProcurementOrder;
}

export interface DetailedOrderSupplier extends ProcurementOrderSupplier {
  supplier: ProcurementSupplier;
  order: ProcurementOrder;
}

export interface DetailedOrder extends ProcurementOrder {
  suppliers: DetailedOrderSupplier[];
  products: DetailedOrderProduct[];
  prices: ProcurementSupplierProductPrice[];
  productQuantities: ProcurementOrderProductQuantity[];
}

export const HISTORY_COLORS: OrderPriceColor[] = Object.keys(
  OrderPriceColor,
) as OrderPriceColor[];

export type HistoryPrice = Record<
  string,
  { value: number; color?: OrderPriceColor }
>;

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

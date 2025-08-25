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

export interface ProcurementProductWithOrderStatus extends ProcurementProduct {
  ordered?: boolean;
}

export interface ProcurementOrderProductWithPricing {
  id: string;
  orderId: string;
  productId: string;
  ordered?: boolean;
  singleProductPrice?: number;
  singleProductPercent?: number;
  bulkProductPrice?: number;
  bulkProductPercent?: number;
  finalSinglePrice?: number;
  finalBulkPrice?: number;
  comment?: string;
  orderReceived?: boolean;
  createdAt: Date;
}

export interface DetailedOrderProductWithPricing
  extends ProcurementOrderProductWithPricing {
  product: ProcurementProduct;
  order: ProcurementOrder;
}

export interface DetailedOrderWithPricing extends ProcurementOrder {
  suppliers: DetailedOrderSupplier[];
  products: DetailedOrderProductWithPricing[];
  prices: ProcurementSupplierProductPrice[];
  productQuantities: ProcurementOrderProductQuantity[];
}

export interface ProductPriceData {
  id?: string;
  productId: string;
  originalPrice?: number;
  originalCurrency?: string;
  bulkPrice?: number;
  singlePrice?: number;
  lastUpdatedFromOrderId?: string;
  lastUpdatedFromProductId?: string;
}

export interface DetailedProductPrice extends ProductPriceData {
  product: ProcurementProduct;
  createdAt?: Date;
  updatedAt?: Date;
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

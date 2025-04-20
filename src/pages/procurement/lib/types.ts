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

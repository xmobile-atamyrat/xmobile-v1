import {
  CalculationEntry,
  CalculationHistory,
  ProcurementProduct,
  Supplier,
} from '@prisma/client';

export interface DetailedHistory extends CalculationHistory {
  suppliers: Supplier[];
  procurementProducts: ProcurementProduct[];
  calculationEntries: CalculationEntry[];
}

export type HistoryColor = 'red' | 'green' | 'orange';

export interface HistoryPrice {
  value: number;
  color: HistoryColor;
  id: string;
}

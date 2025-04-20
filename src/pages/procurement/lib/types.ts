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

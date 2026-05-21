export interface Creditor {
  id: string;
  name: string;
  debtAmount: number;
}

export interface Collateral {
  id: string;
  name: string;
  value: number;
}

export interface Claim {
  creditorId: string;
  collateralId: string;
  priority: number;
}

export interface ParsedClaim {
  creditorName: string;
  debtAmount: number;
  collateralName: string;
  collateralValue: number;
  priority: number;
}

export interface ColumnMapping {
  creditorName: string;
  debtAmount: string;
  collateralName: string;
  collateralValue: string;
  priority: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface AllocationEntry {
  creditorId: string;
  creditorName: string;
  collateralId: string;
  collateralName: string;
  amount: number;
  priority: number;
}

export interface CreditorSummaryItem {
  creditorId: string;
  creditorName: string;
  totalDebt: number;
  totalRecovery: number;
  recoveryRate: number;
  shortfall: number;
}

export interface PropertySummaryItem {
  collateralId: string;
  collateralName: string;
  totalValue: number;
  totalAllocated: number;
  remainingValue: number;
}

export interface AllocationResult {
  entries: AllocationEntry[];
  creditorSummary: CreditorSummaryItem[];
  propertySummary: PropertySummaryItem[];
  totalDistributed: number;
  totalCollateralValue: number;
  totalDebt: number;
}

/** Allocation matrix: rows = creditors, cols = collaterals, cells = allocated amount */
export interface AllocationMatrix {
  creditors: string[];
  collaterals: string[];
  /** matrix[creditorIdx][collateralIdx] = allocated amount */
  matrix: number[][];
  /** Per-creditor row totals */
  rowTotals: number[];
  /** Per-collateral column totals */
  colTotals: number[];
}

export type AppStep = 'upload' | 'preview' | 'results';

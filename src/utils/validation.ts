import { ParsedClaim, ValidationError } from '../types';

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateClaims(claims: ParsedClaim[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Track collateral values and creditor debts for consistency check
  const collateralValues = new Map<string, number>();
  const creditorDebts = new Map<string, number>();

  for (let i = 0; i < claims.length; i++) {
    const row = claims[i];
    const rowNum = i + 2; // +2 because row 1 is header, index is 0-based

    if (!row.creditorName) {
      errors.push({ row: rowNum, field: '债权人名称', message: '债权人名称不能为空' });
    }
    if (!row.collateralName) {
      errors.push({ row: rowNum, field: '抵押物名称', message: '抵押物名称不能为空' });
    }
    if (row.debtAmount <= 0) {
      errors.push({ row: rowNum, field: '债权金额', message: '债权金额必须大于0' });
    }
    if (row.collateralValue <= 0) {
      errors.push({ row: rowNum, field: '抵押物评估值', message: '抵押物评估值必须大于0' });
    }
    if (row.priority < 1 || !Number.isInteger(row.priority)) {
      errors.push({ row: rowNum, field: '顺位', message: '顺位必须为正整数' });
    }

    // Check collateral value consistency
    if (row.collateralName && row.collateralValue > 0) {
      const existing = collateralValues.get(row.collateralName);
      if (existing !== undefined && Math.abs(existing - row.collateralValue) > 0.01) {
        errors.push({
          row: rowNum,
          field: '抵押物评估值',
          message: `抵押物"${row.collateralName}"的评估值不一致（之前为${existing}，当前为${row.collateralValue}）`,
        });
      } else if (existing === undefined) {
        collateralValues.set(row.collateralName, row.collateralValue);
      }
    }

    // Check creditor debt consistency
    if (row.creditorName && row.debtAmount > 0) {
      const existing = creditorDebts.get(row.creditorName);
      if (existing !== undefined && Math.abs(existing - row.debtAmount) > 0.01) {
        errors.push({
          row: rowNum,
          field: '债权金额',
          message: `债权人"${row.creditorName}"的债权金额不一致（之前为${existing}，当前为${row.debtAmount}），同一债权人的债权金额必须相同`,
        });
      } else if (existing === undefined) {
        creditorDebts.set(row.creditorName, row.debtAmount);
      }
    }
  }

  // Auto-merge warnings: same creditor + same collateral
  const pairMap = new Map<string, { rows: number[]; priorities: number[] }>();
  for (let i = 0; i < claims.length; i++) {
    const row = claims[i];
    if (!row.creditorName || !row.collateralName) continue;
    const key = `${row.creditorName}||${row.collateralName}`;
    const existing = pairMap.get(key);
    if (existing) {
      existing.rows.push(i + 2);
      existing.priorities.push(row.priority);
    } else {
      pairMap.set(key, { rows: [i + 2], priorities: [row.priority] });
    }
  }

  for (const [key, val] of pairMap) {
    if (val.rows.length > 1) {
      const [creditor, collateral] = key.split('||');
      // Check if priorities differ
      const uniquePriorities = [...new Set(val.priorities)];
      if (uniquePriorities.length > 1) {
        const minP = Math.min(...uniquePriorities);
        warnings.push({
          row: 0,
          field: '顺位',
          message: `债权人"${creditor}"对抵押物"${collateral}"存在多个不同顺位（${uniquePriorities.join('、')}），系统自动取最高优先级（顺位${minP}）`,
        });
      }
      warnings.push({
        row: 0,
        field: '债权金额',
        message: `债权人"${creditor}"对抵押物"${collateral}"存在${val.rows.length}条记录（第${val.rows.join('、')}行），系统自动累加债权金额`,
      });
    }
  }

  return { errors, warnings };
}

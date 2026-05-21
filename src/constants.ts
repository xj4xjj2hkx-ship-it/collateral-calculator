import { ColumnMapping } from './types';

export const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  creditorName: ['债权人', '债权人名称', '债权方', 'creditor', 'creditor_name', 'creditor name'],
  debtAmount: ['债权金额', '债务金额', '债权数额', '金额', 'debt', 'debt_amount', 'debt amount', 'amount'],
  collateralName: ['担保物', '抵押物', '质押物', '担保物名称', '抵押物名称', 'collateral', 'collateral_name', 'collateral name', '抵押物'],
  collateralValue: ['担保物价值', '抵押物价值', '评估值', '评估价值', '担保物评估值', '抵押物评估值', 'collateral_value', 'collateral value', 'value'],
  priority: ['顺位', '优先级', '优先顺位', '抵押顺位', '抵押权顺位', 'priority', 'rank'],
};

export const SAMPLE_DATA = [
  { creditorName: '甲', debtAmount: 500, collateralName: '厂房A', collateralValue: 400, priority: 1 },
  { creditorName: '乙', debtAmount: 300, collateralName: '厂房A', collateralValue: 400, priority: 1 },
  { creditorName: '甲', debtAmount: 200, collateralName: '设备B', collateralValue: 250, priority: 1 },
  { creditorName: '丙', debtAmount: 400, collateralName: '设备B', collateralValue: 250, priority: 1 },
  { creditorName: '丁', debtAmount: 600, collateralName: '仓库C', collateralValue: 500, priority: 2 },
];

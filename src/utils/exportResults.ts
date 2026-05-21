import * as XLSX from 'xlsx';
import { AllocationResult, AllocationMatrix, ParsedClaim } from '../types';

function buildMatrix(result: AllocationResult): AllocationMatrix {
  const creditors = [...new Set(result.entries.map(e => e.creditorName))];
  const collaterals = [...new Set(result.entries.map(e => e.collateralName))];

  const matrix: number[][] = creditors.map(() => collaterals.map(() => 0));
  for (const e of result.entries) {
    const ci = creditors.indexOf(e.creditorName);
    const ki = collaterals.indexOf(e.collateralName);
    if (ci >= 0 && ki >= 0) {
      matrix[ci][ki] += e.amount;
    }
  }

  const rowTotals = matrix.map(row => row.reduce((s, v) => s + v, 0));
  const colTotals = collaterals.map((_, ki) => matrix.reduce((s, row) => s + row[ki], 0));

  return { creditors, collaterals, matrix, rowTotals, colTotals };
}

export function exportToExcel(result: AllocationResult, parsedClaims?: ParsedClaim[]): void {
  const wb = XLSX.utils.book_new();
  const mx = buildMatrix(result);

  // Sheet 0: 原始数据 + 受偿金额
  if (parsedClaims && parsedClaims.length > 0) {
    // Build allocation lookup: (creditorName, collateralName) -> totalAmount
    const allocMap = new Map<string, number>();
    for (const e of result.entries) {
      const key = `${e.creditorName}||${e.collateralName}`;
      allocMap.set(key, (allocMap.get(key) || 0) + e.amount);
    }

    // Count collaterals per creditor and creditors per collateral
    const creditorCollaterals = new Map<string, Set<string>>();
    const collateralCreditors = new Map<string, Set<string>>();
    for (const c of parsedClaims) {
      if (!creditorCollaterals.has(c.creditorName)) creditorCollaterals.set(c.creditorName, new Set());
      creditorCollaterals.get(c.creditorName)!.add(c.collateralName);
      if (!collateralCreditors.has(c.collateralName)) collateralCreditors.set(c.collateralName, new Set());
      collateralCreditors.get(c.collateralName)!.add(c.creditorName);
    }

    // 连通分量分类
    const allNodes = [...new Set<string>([
      ...Array.from(creditorCollaterals.keys()),
      ...Array.from(collateralCreditors.keys()),
    ])];
    const nodeIndex = new Map(allNodes.map((n, i) => [n, i]));
    const parent = allNodes.map((_, i) => i);
    function find(x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a: number, b: number): void { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

    for (const c of parsedClaims) {
      const ci = nodeIndex.get(c.creditorName)!;
      const ki = nodeIndex.get(c.collateralName)!;
      union(ci, ki);
    }

    const comps = new Map<number, { creditors: Set<string>; collaterals: Set<string> }>();
    for (const c of parsedClaims) {
      const root = find(nodeIndex.get(c.creditorName)!);
      if (!comps.has(root)) comps.set(root, { creditors: new Set(), collaterals: new Set() });
      const comp = comps.get(root)!;
      comp.creditors.add(c.creditorName);
      comp.collaterals.add(c.collateralName);
    }

    function classifyComp(comp: { creditors: Set<string>; collaterals: Set<string> }): string {
      const nc = comp.creditors.size, nk = comp.collaterals.size;
      if (nc === 1 && nk === 1) return '1对1';
      if (nc === 1 && nk > 1) return '多对1';
      if (nc > 1 && nk === 1) return '1对多';
      return '多对多';
    }

    const compTypeMap = new Map<number, string>();
    const compIdMap = new Map<number, number>();
    let compSeq = 0;
    for (const [root, comp] of comps) {
      compTypeMap.set(root, classifyComp(comp));
      compIdMap.set(root, ++compSeq);
    }

    function relType(creditor: string, collateral: string): string {
      const root = find(nodeIndex.get(creditor)!);
      return compTypeMap.get(root) || '1对1';
    }

    function compLabel(creditor: string): string {
      const root = find(nodeIndex.get(creditor)!);
      const id = compIdMap.get(root) || 1;
      const comp = comps.get(root)!;
      return `${id}:[${[...comp.creditors].join('+')}|${[...comp.collaterals].join('+')}]`;
    }

    const claimRows = parsedClaims.map(c => ({
      '组合包': compLabel(c.creditorName),
      '债权人': c.creditorName,
      '债权金额': c.debtAmount,
      '担保物': c.collateralName,
      '评估值': c.collateralValue,
      '顺位': c.priority,
      '关系类型': relType(c.creditorName, c.collateralName),
      '受偿金额': allocMap.get(`${c.creditorName}||${c.collateralName}`) || 0,
    }));
    const ws0 = XLSX.utils.json_to_sheet(claimRows);
    ws0['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws0, '分配结果');
  }

  // Sheet 1: 分配矩阵（宽格式）
  const matrixRows = mx.creditors.map((creditor, ci) => {
    const row: Record<string, number | string> = { '债权人': creditor };
    mx.collaterals.forEach((col, ki) => {
      row[col] = mx.matrix[ci][ki];
    });
    row['合计'] = mx.rowTotals[ci];
    return row;
  });
  // Add totals row
  const totalsRow: Record<string, number | string> = { '债权人': '合计' };
  mx.collaterals.forEach((col, ki) => {
    totalsRow[col] = mx.colTotals[ki];
  });
  totalsRow['合计'] = result.totalDistributed;
  matrixRows.push(totalsRow);

  const ws1 = XLSX.utils.json_to_sheet(matrixRows);
  ws1['!cols'] = [{ wch: 16 }, ...mx.collaterals.map(() => ({ wch: 14 })), { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, '分配矩阵');

  // Sheet 2: 分配明细（长格式）
  const detailRows = result.entries.map(e => ({
    '债权人': e.creditorName,
    '担保物': e.collateralName,
    '顺位': e.priority,
    '分配金额': e.amount,
  }));
  const ws2 = XLSX.utils.json_to_sheet(detailRows);
  ws2['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, '分配明细');

  // Sheet 3: 债权人汇总
  const creditorRows = result.creditorSummary.map(c => ({
    '债权人': c.creditorName,
    '担保债权总额': c.totalDebt,
    '优先受偿总额': c.totalRecovery,
    '清偿率': (c.recoveryRate * 100).toFixed(2) + '%',
    '未受偿金额': c.shortfall,
  }));
  const ws3 = XLSX.utils.json_to_sheet(creditorRows);
  ws3['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, '债权人汇总');

  // Sheet 4: 担保物明细
  const collateralRows = result.propertySummary.map(p => ({
    '担保物': p.collateralName,
    '评估值': p.totalValue,
    '已分配总额': p.totalAllocated,
    '剩余价值': p.remainingValue,
    '利用率': (p.totalValue > 0 ? (p.totalAllocated / p.totalValue * 100).toFixed(2) : '0.00') + '%',
  }));
  const ws4 = XLSX.utils.json_to_sheet(collateralRows);
  ws4['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws4, '担保物明细');

  // Sheet 5: 汇总统计
  const avgRate = result.creditorSummary.length > 0
    ? result.creditorSummary.reduce((s, c) => s + c.recoveryRate, 0) / result.creditorSummary.length
    : 0;
  const utilization = result.totalCollateralValue > 0
    ? result.totalDistributed / result.totalCollateralValue
    : 0;

  const overviewRows = [
    { '项目': '担保物总价值', '数值': result.totalCollateralValue },
    { '项目': '担保债权总额', '数值': result.totalDebt },
    { '项目': '优先受偿总额', '数值': result.totalDistributed },
    { '项目': '平均清偿率', '数值': (avgRate * 100).toFixed(2) + '%' },
    { '项目': '抵押物价值利用率', '数值': (utilization * 100).toFixed(2) + '%' },
  ];
  const ws5 = XLSX.utils.json_to_sheet(overviewRows);
  ws5['!cols'] = [{ wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, '汇总统计');

  XLSX.writeFile(wb, '担保物权分配结果.xlsx');
}

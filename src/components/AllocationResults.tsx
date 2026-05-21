import React, { useMemo } from 'react';
import { AllocationResult, ParsedClaim } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatCurrency';
import { exportToExcel } from '../utils/exportResults';

interface Props {
  result: AllocationResult;
  parsedClaims: ParsedClaim[];
}

const AllocationResults: React.FC<Props> = ({ result, parsedClaims }) => {
  const avgRate = useMemo(() => {
    if (result.creditorSummary.length === 0) return 0;
    return result.creditorSummary.reduce((s, c) => s + c.recoveryRate, 0) / result.creditorSummary.length;
  }, [result]);

  const utilization = useMemo(() => {
    if (result.totalCollateralValue === 0) return 0;
    return result.totalDistributed / result.totalCollateralValue;
  }, [result]);

  // Allocation matrix
  const creditors = useMemo(() => [...new Set(result.entries.map(e => e.creditorName))], [result]);
  const collaterals = useMemo(() => [...new Set(result.entries.map(e => e.collateralName))], [result]);
  const matrix = useMemo(() => {
    const m = creditors.map(() => collaterals.map(() => 0));
    for (const e of result.entries) {
      const ci = creditors.indexOf(e.creditorName);
      const ki = collaterals.indexOf(e.collateralName);
      if (ci >= 0 && ki >= 0) m[ci][ki] += e.amount;
    }
    return m;
  }, [result, creditors, collaterals]);

  return (
    <div className="results-section">
      {/* Summary cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <strong>优先受偿总额</strong>
          <p className="text-green">{formatCurrency(result.totalDistributed)}</p>
        </div>
        <div className="summary-card">
          <strong>平均清偿率</strong>
          <p>{formatPercent(avgRate)}</p>
        </div>
        <div className="summary-card">
          <strong>抵押物价值利用率</strong>
          <p>{formatPercent(utilization)}</p>
        </div>
        <div className="summary-card">
          <strong>债权总额</strong>
          <p>{formatCurrency(result.totalDebt)}</p>
        </div>
      </div>

      {/* Allocation matrix */}
      <div className="result-card glass-card">
        <h3>分配矩阵（债权人 × 担保物）</h3>
        <div className="result-table-wrapper">
          <table className="result-table matrix-table">
            <thead>
              <tr>
                <th></th>
                {collaterals.map(c => <th key={c}>{c}<br /><span className="th-sub">({formatCurrency(result.propertySummary.find(p => p.collateralName === c)?.totalValue || 0)})</span></th>)}
                <th className="matrix-total-col">合计</th>
              </tr>
            </thead>
            <tbody>
              {creditors.map((cr, ci) => {
                const rowTotal = matrix[ci].reduce((s, v) => s + v, 0);
                return (
                  <tr key={cr}>
                    <td className="matrix-row-header">{cr}<br /><span className="th-sub">债权{formatCurrency(result.creditorSummary.find(c => c.creditorName === cr)?.totalDebt || 0)}</span></td>
                    {collaterals.map((_, ki) => (
                      <td key={ki} className={matrix[ci][ki] > 0 ? 'matrix-cell-has-value' : ''}>
                        {matrix[ci][ki] > 0 ? formatCurrency(matrix[ci][ki]) : '-'}
                      </td>
                    ))}
                    <td className="matrix-total-col text-green">{formatCurrency(rowTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="matrix-row-header">合计</td>
                {collaterals.map((c, ki) => {
                  const colTotal = matrix.reduce((s, row) => s + row[ki], 0);
                  return <td key={ki} className="text-green">{formatCurrency(colTotal)}</td>;
                })}
                <td className="matrix-total-col text-green">{formatCurrency(result.totalDistributed)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Creditor detail table */}
      <div className="result-card glass-card">
        <h3>债权人优先受偿明细表</h3>
        <div className="result-table-wrapper">
          <table className="result-table">
            <thead>
              <tr>
                <th>债权人</th>
                <th>担保债权总额</th>
                <th>优先受偿总额</th>
                <th>清偿率</th>
                <th>未受偿金额</th>
                <th>受偿明细</th>
              </tr>
            </thead>
            <tbody>
              {result.creditorSummary.map(c => {
                const entries = result.entries.filter(e => e.creditorName === c.creditorName);
                return (
                  <tr key={c.creditorId}>
                    <td className="cell-name">{c.creditorName}</td>
                    <td className="cell-number">{formatCurrency(c.totalDebt)}</td>
                    <td className="cell-number text-green">{formatCurrency(c.totalRecovery)}</td>
                    <td className="cell-number">
                      <div className="recovery-bar-cell">
                        <div className="recovery-bar-bg"><div className="recovery-bar-fill" style={{ width: `${Math.min(100, c.recoveryRate * 100)}%` }} /></div>
                        <span>{formatPercent(c.recoveryRate)}</span>
                      </div>
                    </td>
                    <td className="cell-number text-red">{c.shortfall > 0 ? formatCurrency(c.shortfall) : '-'}</td>
                    <td className="cell-detail">
                      {entries.map((e, i) => (
                        <span key={i} className="detail-chip">{e.collateralName}: {formatCurrency(e.amount)}</span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collateral detail table */}
      <div className="result-card glass-card">
        <h3>抵押物分配明细表</h3>
        <div className="result-table-wrapper">
          <table className="result-table">
            <thead>
              <tr>
                <th>抵押物</th>
                <th>评估值</th>
                <th>已分配总额</th>
                <th>剩余价值</th>
                <th>利用率</th>
                <th>分配去向</th>
              </tr>
            </thead>
            <tbody>
              {result.propertySummary.map(p => {
                const entries = result.entries.filter(e => e.collateralName === p.collateralName);
                return (
                  <tr key={p.collateralId}>
                    <td className="cell-name">{p.collateralName}</td>
                    <td className="cell-number">{formatCurrency(p.totalValue)}</td>
                    <td className="cell-number">{formatCurrency(p.totalAllocated)}</td>
                    <td className="cell-number">{formatCurrency(p.remainingValue)}</td>
                    <td className="cell-number">
                      <div className="recovery-bar-cell">
                        <div className="recovery-bar-bg"><div className="recovery-bar-fill fill-blue" style={{ width: `${Math.min(100, (p.totalAllocated / p.totalValue) * 100)}%` }} /></div>
                        <span>{formatPercent(p.totalValue > 0 ? p.totalAllocated / p.totalValue : 0)}</span>
                      </div>
                    </td>
                    <td className="cell-detail">
                      {entries.map((e, i) => (
                        <span key={i} className="detail-chip">{e.creditorName}(顺位{e.priority}): {formatCurrency(e.amount)}</span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export */}
      <div className="result-actions">
        <button className="btn btn-primary" onClick={() => exportToExcel(result, parsedClaims)}>导出 Excel</button>
      </div>
    </div>
  );
};

export default AllocationResults;

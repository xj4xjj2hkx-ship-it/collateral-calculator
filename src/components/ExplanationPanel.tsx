import React, { useState, useMemo } from 'react';
import { ParsedClaim, AllocationResult } from '../types';
import { runAllocation } from '../utils/allocationEngine';
import { formatCurrency, formatPercent } from '../utils/formatCurrency';
import { validateClaims, ValidationResult } from '../utils/validation';

// ============================================================
// Scenario ④ 示例矩阵数据
// ============================================================

const EXAMPLE_MATRIX: ParsedClaim[] = [
  { creditorName: '债权人1', debtAmount: 600, collateralName: '物1', collateralValue: 500, priority: 1 },
  { creditorName: '债权人1', debtAmount: 300, collateralName: '物2', collateralValue: 400, priority: 1 },
  { creditorName: '债权人2', debtAmount: 200, collateralName: '物2', collateralValue: 400, priority: 1 },
  { creditorName: '债权人2', debtAmount: 400, collateralName: '物3', collateralValue: 350, priority: 1 },
  { creditorName: '债权人2', debtAmount: 500, collateralName: '物4', collateralValue: 300, priority: 1 },
  { creditorName: '债权人3', debtAmount: 150, collateralName: '物2', collateralValue: 400, priority: 1 },
  { creditorName: '债权人3', debtAmount: 200, collateralName: '物3', collateralValue: 350, priority: 1 },
  { creditorName: '债权人3', debtAmount: 200, collateralName: '物4', collateralValue: 300, priority: 1 },
];

// ============================================================
// Sub-components
// ============================================================

interface MatrixViewProps {
  result: AllocationResult;
}

const AllocationMatrixView: React.FC<MatrixViewProps> = ({ result }) => {
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

  const rowTotals = matrix.map(row => row.reduce((s, v) => s + v, 0));
  const colTotals = collaterals.map((_, ki) => matrix.reduce((s, row) => s + row[ki], 0));

  return (
    <div className="matrix-view">
      <h5>分配矩阵</h5>
      <div className="matrix-table-wrapper">
        <table className="matrix-table">
          <thead>
            <tr>
              <th></th>
              {collaterals.map(c => <th key={c}>{c}</th>)}
              <th className="matrix-total-col">合计</th>
            </tr>
          </thead>
          <tbody>
            {creditors.map((cr, ci) => (
              <tr key={cr}>
                <td className="matrix-row-header">{cr}</td>
                {collaterals.map((_, ki) => (
                  <td key={ki} className={matrix[ci][ki] > 0 ? 'matrix-cell-has-value' : ''}>
                    {matrix[ci][ki] > 0 ? formatCurrency(matrix[ci][ki]) : '-'}
                  </td>
                ))}
                <td className="matrix-total-col text-green">{formatCurrency(rowTotals[ci])}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="matrix-row-header">合计</td>
              {collaterals.map((_, ki) => (
                <td key={ki} className="text-green">{formatCurrency(colTotals[ki])}</td>
              ))}
              <td className="matrix-total-col text-green">{formatCurrency(result.totalDistributed)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

interface FlowDiagramProps {
  claims: ParsedClaim[];
  result: AllocationResult | null;
}

const COLLATERAL_COLORS = ['#6d5bff', '#1de9b6', '#ff6b9d', '#ffa726', '#42a5f5', '#ab47bc', '#26c6da', '#ff7043'];

const FlowDiagram: React.FC<FlowDiagramProps> = ({ claims, result }) => {
  const creditors = useMemo(() => {
    const seen = new Set<string>();
    return claims.filter(c => { if (seen.has(c.creditorName)) return false; seen.add(c.creditorName); return true; }).map(c => c.creditorName);
  }, [claims]);

  const collaterals = useMemo(() => {
    const seen = new Set<string>();
    return claims.filter(c => { if (seen.has(c.collateralName)) return false; seen.add(c.collateralName); return true; }).map(c => c.collateralName);
  }, [claims]);

  // Build allocation matrix
  const matrix = useMemo(() => {
    if (!result) return creditors.map(() => collaterals.map(() => 0));
    const m = creditors.map(() => collaterals.map(() => 0));
    for (const e of result.entries) {
      const ci = creditors.indexOf(e.creditorName);
      const ki = collaterals.indexOf(e.collateralName);
      if (ci >= 0 && ki >= 0) m[ci][ki] += e.amount;
    }
    return m;
  }, [result, creditors, collaterals]);

  const maxTotal = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, ...result.creditorSummary.map(c => c.totalDebt));
  }, [result]);

  // Layout
  const barH = 36;
  const barGap = 16;
  const labelW = 80;
  const rightLabelW = 60;
  const chartX = labelW;
  const chartMaxW = 420;
  const topPad = 40;
  const legendH = collaterals.length * 18 + 20;
  const W = labelW + chartMaxW + rightLabelW + 20;
  const H = topPad + creditors.length * (barH + barGap) + legendH + 20;

  const scale = (v: number) => (v / maxTotal) * chartMaxW;

  return (
    <div className="flow-diagram-container">
      <svg viewBox={`0 0 ${W} ${H}`} className="flow-svg" style={{ maxWidth: W }}>
        {/* Title */}
        <text x={chartX} y={22} className="flow-col-label" style={{ textTransform: 'none', fontSize: 11 }}>
          受偿分布（按担保物分段）
        </text>
        <text x={chartX + chartMaxW} y={22} textAnchor="end" className="flow-col-label" style={{ textTransform: 'none', fontSize: 10 }}>
          最大值: {formatCurrency(maxTotal)}
        </text>

        {/* Bars */}
        {creditors.map((name, ci) => {
          const y = topPad + ci * (barH + barGap);
          const summary = result?.creditorSummary.find(c => c.creditorName === name);
          const totalDebt = summary?.totalDebt || 0;
          const totalRecovery = summary?.totalRecovery || 0;
          const rate = summary?.recoveryRate || 0;
          const barW = scale(totalRecovery);
          const debtLine = scale(totalDebt);

          // Build stacked segments
          let segX = chartX;
          const segments: { x: number; w: number; color: string; label: string; amount: number }[] = [];
          for (let ki = 0; ki < collaterals.length; ki++) {
            const val = matrix[ci][ki];
            if (val > 0) {
              const sw = scale(val);
              segments.push({ x: segX, w: sw, color: COLLATERAL_COLORS[ki % COLLATERAL_COLORS.length], label: collaterals[ki], amount: val });
              segX += sw;
            }
          }

          return (
            <g key={name}>
              {/* Creditor label */}
              <text x={labelW - 8} y={y + barH / 2 + 4} textAnchor="end" className="flow-node-name" style={{ fontSize: 12 }}>
                {name}
              </text>

              {/* Background track */}
              <rect x={chartX} y={y} width={chartMaxW} height={barH} rx={8} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

              {/* Debt total line */}
              {totalDebt > 0 && (
                <line x1={chartX + debtLine} y1={y - 2} x2={chartX + debtLine} y2={y + barH + 2} stroke="rgba(255,107,107,0.4)" strokeWidth={1.5} strokeDasharray="4,3" />
              )}

              {/* Stacked segments */}
              {segments.map((seg, si) => (
                <g key={si}>
                  <rect x={seg.x} y={y} width={Math.max(2, seg.w)} height={barH} rx={si === 0 ? 8 : 0} fill={seg.color} opacity={0.75} />
                  {seg.w > 40 && (
                    <text x={seg.x + seg.w / 2} y={y + barH / 2 + 4} textAnchor="middle" fill="#fff" style={{ fontSize: 9, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {formatCurrency(seg.amount)}
                    </text>
                  )}
                </g>
              ))}

              {/* Right label: recovery / debt = rate */}
              <text x={chartX + chartMaxW + 10} y={y + barH / 2 - 4} className="flow-node-name" style={{ fontSize: 11, fill: rate >= 0.99 ? '#1de9b6' : '#f4f7ff' }}>
                {formatCurrency(totalRecovery)}
              </text>
              <text x={chartX + chartMaxW + 10} y={y + barH / 2 + 10} className="flow-node-sub" style={{ fontSize: 9 }}>
                {formatPercent(rate)}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${chartX}, ${topPad + creditors.length * (barH + barGap) + 10})`}>
          <text y={0} className="flow-col-label" style={{ textTransform: 'none', fontSize: 10 }}>图例</text>
          {collaterals.map((name, ki) => {
            const val = claims.find(c => c.collateralName === name)?.collateralValue || 0;
            return (
              <g key={name} transform={`translate(0, ${16 + ki * 18})`}>
                <rect width={12} height={12} rx={3} fill={COLLATERAL_COLORS[ki % COLLATERAL_COLORS.length]} opacity={0.75} />
                <text x={18} y={10} fill="rgba(235,240,255,0.7)" style={{ fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {name} ({formatCurrency(val)})
                </text>
              </g>
            );
          })}
          {/* Debt line legend */}
          <g transform={`translate(${collaterals.length > 3 ? 180 : 0}, ${16})`}>
            <line x1={0} y1={6} x2={16} y2={6} stroke="rgba(255,107,107,0.4)" strokeWidth={1.5} strokeDasharray="4,3" />
            <text x={22} y={10} fill="rgba(255,107,107,0.6)" style={{ fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif' }}>
              债权总额
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};

// ============================================================
// Main Simulator Component
// ============================================================

type ScenarioKey = 's1' | 's2' | 's3' | 's4';

const SCENARIOS: { key: ScenarioKey; label: string; title: string; desc: string }[] = [
  { key: 's1', label: '①', title: '1债权 → 1担保物', desc: 'min(债权, 物值)' },
  { key: 's2', label: '②', title: '多债权 → 1担保物', desc: '同顺位按债权比例分配' },
  { key: 's3', label: '③', title: '1债权 → 多担保物', desc: '依次满足至债权足额' },
  { key: 's4', label: '④', title: '多债权 ⇄ 多担保物', desc: '排他物优先 + 按比例分配' },
];

const ExplanationPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ScenarioKey>('s4');

  // Scenario ① state
  const [s1Debt, setS1Debt] = useState(600);
  const [s1Val, setS1Val] = useState(400);
  const [s1Pri, setS1Pri] = useState(1);
  const [s1Result, setS1Result] = useState<AllocationResult | null>(null);

  // Scenario ② state
  const [s2Debts, setS2Debts] = useState('600,300,100');
  const [s2Val, setS2Val] = useState(400);
  const [s2Pri, setS2Pri] = useState(1);
  const [s2Result, setS2Result] = useState<AllocationResult | null>(null);

  // Scenario ③ state
  const [s3Debt, setS3Debt] = useState(800);
  const [s3Vals, setS3Vals] = useState('500,400');
  const [s3Pri, setS3Pri] = useState(1);
  const [s3Result, setS3Result] = useState<AllocationResult | null>(null);

  // Scenario ④ state
  const [s4Claims, setS4Claims] = useState<ParsedClaim[]>(EXAMPLE_MATRIX);
  const [s4Result, setS4Result] = useState<AllocationResult | null>(null);
  const [s4Validation, setS4Validation] = useState<ValidationResult | null>(null);

  // Run handlers
  const runS1 = () => {
    const claims: ParsedClaim[] = [{ creditorName: '债权人A', debtAmount: s1Debt, collateralName: '担保物1', collateralValue: s1Val, priority: s1Pri }];
    setS1Result(runAllocation(claims));
  };

  const runS2 = () => {
    const debts = s2Debts.split(/[,，\s]+/).map(s => parseFloat(s.trim())).filter(n => n > 0);
    const claims: ParsedClaim[] = debts.map((d, i) => ({
      creditorName: `债权人${String.fromCharCode(65 + i)}`, debtAmount: d, collateralName: '担保物1', collateralValue: s2Val, priority: s2Pri,
    }));
    setS2Result(runAllocation(claims));
  };

  const runS3 = () => {
    const vals = s3Vals.split(/[,，\s]+/).map(s => parseFloat(s.trim())).filter(n => n > 0);
    const claims: ParsedClaim[] = vals.map((v, i) => ({
      creditorName: '债权人A', debtAmount: s3Debt, collateralName: `担保物${i + 1}`, collateralValue: v, priority: s3Pri,
    }));
    setS3Result(runAllocation(claims));
  };

  const runS4 = () => {
    if (s4Claims.length === 0) return;
    const vr = validateClaims(s4Claims);
    setS4Validation(vr);
    if (vr.errors.length > 0) {
      setS4Result(null);
      return;
    }
    setS4Result(runAllocation(s4Claims));
  };

  const loadExample = () => {
    setS4Claims([...EXAMPLE_MATRIX]);
    setS4Result(null);
    setS4Validation(null);
  };

  // Scenario ④ helpers
  const addS4Row = () => {
    setS4Claims(prev => [...prev, { creditorName: '新债权人', debtAmount: 100, collateralName: '物1', collateralValue: 500, priority: 1 }]);
  };
  const deleteS4Row = (idx: number) => {
    setS4Claims(prev => prev.filter((_, i) => i !== idx));
  };
  const editS4Cell = (idx: number, field: keyof ParsedClaim, value: string | number) => {
    setS4Validation(null);
    setS4Claims(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Sync collateral value across all rows with same collateral name
      if (field === 'collateralValue' && typeof value === 'number') {
        const colName = updated[idx].collateralName;
        for (let i = 0; i < updated.length; i++) {
          if (i !== idx && updated[i].collateralName === colName) {
            updated[i] = { ...updated[i], collateralValue: value };
          }
        }
      }
      // Sync debt amount across all rows with same creditor name
      if (field === 'debtAmount' && typeof value === 'number') {
        const crName = updated[idx].creditorName;
        for (let i = 0; i < updated.length; i++) {
          if (i !== idx && updated[i].creditorName === crName) {
            updated[i] = { ...updated[i], debtAmount: value };
          }
        }
      }
      return updated;
    });
  };

  return (
    <div className="simulator">
      {/* Legal basis brief */}
      <div className="legal-brief">
        <span className="legal-badge">民法典 第414条</span>
        <span className="legal-badge">企业破产法 第109条</span>
      </div>

      {/* Tabs */}
      <div className="sim-tabs">
        {SCENARIOS.map(s => (
          <button key={s.key} className={`sim-tab ${activeTab === s.key ? 'active' : ''}`} onClick={() => setActiveTab(s.key)}>
            <span className="sim-tab-num">{s.label}</span>
            <span className="sim-tab-title">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Scenario ① */}
      {activeTab === 's1' && (
        <div className="sim-scenario">
          <p className="sim-desc">简单一对一：<strong>受偿金额 = min(债权金额, 担保物评估值)</strong></p>
          <div className="sim-inputs">
            <label>债权金额<input type="number" value={s1Debt} onChange={e => setS1Debt(parseFloat(e.target.value) || 0)} className="cell-input cell-number" /></label>
            <label>担保物评估值<input type="number" value={s1Val} onChange={e => setS1Val(parseFloat(e.target.value) || 0)} className="cell-input cell-number" /></label>
            <label>顺位<input type="number" value={s1Pri} onChange={e => setS1Pri(parseInt(e.target.value) || 1)} className="cell-input cell-number cell-small" /></label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={runS1}>运行分配</button>
          {s1Result && (
            <div className="sim-result">
              <div className="sim-result-cards">
                <div className="sim-stat"><span className="sim-stat-label">债权金额</span><span className="sim-stat-value">{formatCurrency(s1Debt)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">担保物评估值</span><span className="sim-stat-value">{formatCurrency(s1Val)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">分配结果</span><span className="sim-stat-value text-green">{formatCurrency(s1Result.totalDistributed)}</span></div>
              </div>
              <div className="sim-path">
                <p>计算路径：min({formatCurrency(s1Debt)}, {formatCurrency(s1Val)}) = <strong className="text-green">{formatCurrency(s1Result.totalDistributed)}</strong></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scenario ② */}
      {activeTab === 's2' && (
        <div className="sim-scenario">
          <p className="sim-desc">同顺位多人：各债权人按<strong>债权比例</strong>分配担保物评估值</p>
          <div className="sim-inputs">
            <label>各债权金额（逗号分隔）<input type="text" value={s2Debts} onChange={e => setS2Debts(e.target.value)} className="cell-input" placeholder="600,300,100" /></label>
            <label>担保物评估值<input type="number" value={s2Val} onChange={e => setS2Val(parseFloat(e.target.value) || 0)} className="cell-input cell-number" /></label>
            <label>顺位<input type="number" value={s2Pri} onChange={e => setS2Pri(parseInt(e.target.value) || 1)} className="cell-input cell-number cell-small" /></label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={runS2}>运行分配</button>
          {s2Result && (
            <div className="sim-result">
              <div className="sim-result-cards">
                <div className="sim-stat"><span className="sim-stat-label">债权总额</span><span className="sim-stat-value">{formatCurrency(s2Result.totalDebt)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">担保物评估值</span><span className="sim-stat-value">{formatCurrency(s2Val)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">总回收额</span><span className="sim-stat-value text-green">{formatCurrency(s2Result.totalDistributed)}</span></div>
              </div>
              <div className="sim-detail-cards">
                {s2Result.creditorSummary.map(c => (
                  <div key={c.creditorId} className="sim-detail-card">
                    <span className="sim-detail-name">{c.creditorName}</span>
                    <span>债权 {formatCurrency(c.totalDebt)}</span>
                    <span className="text-green">受偿 {formatCurrency(c.totalRecovery)} ({formatPercent(c.recoveryRate)})</span>
                  </div>
                ))}
              </div>
              <div className="sim-path">
                <p>计算路径：债权比例分配，物值{formatCurrency(s2Val)}按各债权占总债权比例分配</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scenario ③ */}
      {activeTab === 's3' && (
        <div className="sim-scenario">
          <p className="sim-desc">一人多物：依次从各担保物受偿，直至<strong>债权足额</strong>或物值耗尽</p>
          <div className="sim-inputs">
            <label>债权金额<input type="number" value={s3Debt} onChange={e => setS3Debt(parseFloat(e.target.value) || 0)} className="cell-input cell-number" /></label>
            <label>各担保物评估值（逗号分隔）<input type="text" value={s3Vals} onChange={e => setS3Vals(e.target.value)} className="cell-input" placeholder="500,400" /></label>
            <label>顺位<input type="number" value={s3Pri} onChange={e => setS3Pri(parseInt(e.target.value) || 1)} className="cell-input cell-number cell-small" /></label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={runS3}>运行分配</button>
          {s3Result && (
            <div className="sim-result">
              <div className="sim-result-cards">
                <div className="sim-stat"><span className="sim-stat-label">债权金额</span><span className="sim-stat-value">{formatCurrency(s3Debt)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">担保物总值</span><span className="sim-stat-value">{formatCurrency(s3Result.totalCollateralValue)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">总回收额</span><span className="sim-stat-value text-green">{formatCurrency(s3Result.totalDistributed)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">清偿率</span><span className="sim-stat-value">{formatPercent(s3Result.creditorSummary[0]?.recoveryRate || 0)}</span></div>
              </div>
              <div className="sim-detail-cards">
                {s3Result.propertySummary.map(p => (
                  <div key={p.collateralId} className="sim-detail-card">
                    <span className="sim-detail-name">{p.collateralName}</span>
                    <span>评估值 {formatCurrency(p.totalValue)}</span>
                    <span className="text-green">分配 {formatCurrency(p.totalAllocated)}</span>
                  </div>
                ))}
              </div>
              <div className="sim-path">
                <p>计算路径：min({formatCurrency(s3Debt)}, {formatCurrency(s3Result.totalCollateralValue)}) = {formatCurrency(s3Result.totalDistributed)}，依次从各担保物受偿至债权足额</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scenario ④ */}
      {activeTab === 's4' && (
        <div className="sim-scenario">
          <p className="sim-desc">交叉担保 + 顺位分层：<strong>排他物优先受偿</strong>，释放共享物价值给其他债权人；共享物按<strong>剩余债权比例</strong>分配，实现"最有利于全体债权人受偿"。</p>

          {s4Validation && s4Validation.errors.length > 0 && (
            <div className="validation-errors">
              <h4>输入错误 ({s4Validation.errors.length})</h4>
              <ul>
                {s4Validation.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err.row > 0 ? `第${err.row}行 ` : ''}[{err.field}]: {err.message}</li>
                ))}
                {s4Validation.errors.length > 5 && <li>...还有 {s4Validation.errors.length - 5} 个问题</li>}
              </ul>
            </div>
          )}

          <div className="s4-table-wrapper">
            <table className="s4-table">
              <thead>
                <tr>
                  <th>债权人</th>
                  <th>担保物</th>
                  <th>债权金额</th>
                  <th>担保物评估值</th>
                  <th>顺位</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {s4Claims.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input type="text" value={row.creditorName} onChange={e => editS4Cell(idx, 'creditorName', e.target.value)} className="cell-input" />
                    </td>
                    <td>
                      <input type="text" value={row.collateralName} onChange={e => editS4Cell(idx, 'collateralName', e.target.value)} className="cell-input" />
                    </td>
                    <td>
                      <input type="number" value={row.debtAmount || ''} onChange={e => editS4Cell(idx, 'debtAmount', parseFloat(e.target.value) || 0)} className="cell-input cell-number" />
                    </td>
                    <td>
                      <input type="number" value={row.collateralValue || ''} onChange={e => editS4Cell(idx, 'collateralValue', parseFloat(e.target.value) || 0)} className="cell-input cell-number" />
                    </td>
                    <td>
                      <input type="number" value={row.priority || ''} onChange={e => editS4Cell(idx, 'priority', parseInt(e.target.value) || 1)} className="cell-input cell-number cell-small" />
                    </td>
                    <td>
                      <button className="btn-icon btn-delete" onClick={() => deleteS4Row(idx)}>&times;</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="s4-actions">
            <button className="btn btn-secondary btn-sm" onClick={addS4Row}>+ 添加行</button>
            <button className="btn btn-secondary btn-sm" onClick={loadExample}>示例矩阵</button>
            <button className="btn btn-primary btn-sm" onClick={runS4}>运行分配</button>
          </div>

          {s4Result && (
            <div className="sim-result">
              <div className="sim-result-cards">
                <div className="sim-stat"><span className="sim-stat-label">债权总额</span><span className="sim-stat-value">{formatCurrency(s4Result.totalDebt)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">担保物总值</span><span className="sim-stat-value">{formatCurrency(s4Result.totalCollateralValue)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">总回收额</span><span className="sim-stat-value text-green">{formatCurrency(s4Result.totalDistributed)}</span></div>
                <div className="sim-stat"><span className="sim-stat-label">平均清偿率</span><span className="sim-stat-value">{formatPercent(s4Result.creditorSummary.length > 0 ? s4Result.creditorSummary.reduce((s, c) => s + c.recoveryRate, 0) / s4Result.creditorSummary.length : 0)}</span></div>
              </div>

              <AllocationMatrixView result={s4Result} />
              <FlowDiagram claims={s4Claims} result={s4Result} />

              <div className="sim-path">
                <p>算法：① 排他物优先——仅一位债权人享有担保权的抵押物，先满足该债权人；② 共享物按比例——多位债权人共享的抵押物，按各人剩余债权比例分配，迭代修正至收敛。该顺位总回收额 <strong className="text-green">{formatCurrency(s4Result.totalDistributed)}</strong>。</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplanationPanel;

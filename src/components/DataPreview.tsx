import React from 'react';
import { ParsedClaim } from '../types';
import { ValidationResult } from '../utils/validation';

interface Props {
  data: ParsedClaim[];
  validationResult: ValidationResult;
  onCellEdit: (index: number, field: keyof ParsedClaim, value: string | number) => void;
  onDeleteRow: (index: number) => void;
  onAddRow: () => void;
  onCalculate: () => void;
  onBack: () => void;
}

const DataPreview: React.FC<Props> = ({ data, validationResult, onCellEdit, onDeleteRow, onAddRow, onCalculate, onBack }) => {
  const { errors, warnings } = validationResult;

  return (
    <div className="preview-section">
      {errors.length > 0 && (
        <div className="validation-errors">
          <h4>错误 ({errors.length})</h4>
          <ul>
            {errors.slice(0, 8).map((err, i) => (
              <li key={i}>{err.row > 0 ? `第${err.row}行 ` : ''}[{err.field}]: {err.message}</li>
            ))}
            {errors.length > 8 && <li>...还有 {errors.length - 8} 个问题</li>}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="validation-warnings">
          <h4>提示 ({warnings.length})</h4>
          <ul>
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
            {warnings.length > 5 && <li>...还有 {warnings.length - 5} 条提示</li>}
          </ul>
        </div>
      )}

      <div className="preview-table-wrapper">
        <table className="preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>债权人</th>
              <th>债权金额</th>
              <th>抵押物</th>
              <th>评估值</th>
              <th>顺位</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td className="row-num">{idx + 1}</td>
                <td>
                  <input type="text" value={row.creditorName}
                    onChange={e => onCellEdit(idx, 'creditorName', e.target.value)}
                    className="cell-input" />
                </td>
                <td>
                  <input type="number" value={row.debtAmount || ''}
                    onChange={e => onCellEdit(idx, 'debtAmount', parseFloat(e.target.value) || 0)}
                    className="cell-input cell-number" />
                </td>
                <td>
                  <input type="text" value={row.collateralName}
                    onChange={e => onCellEdit(idx, 'collateralName', e.target.value)}
                    className="cell-input" />
                </td>
                <td>
                  <input type="number" value={row.collateralValue || ''}
                    onChange={e => onCellEdit(idx, 'collateralValue', parseFloat(e.target.value) || 0)}
                    className="cell-input cell-number" />
                </td>
                <td>
                  <input type="number" value={row.priority || ''}
                    onChange={e => onCellEdit(idx, 'priority', parseInt(e.target.value) || 1)}
                    className="cell-input cell-number cell-small" />
                </td>
                <td>
                  <button className="btn-icon btn-delete" onClick={() => onDeleteRow(idx)} title="删除行">&times;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="preview-actions">
        <button className="btn btn-secondary btn-sm" onClick={onAddRow}>+ 添加行</button>
        <div className="preview-actions-right">
          <button className="btn btn-secondary" onClick={onBack}>返回</button>
          <button className="btn btn-primary" onClick={onCalculate} disabled={data.length === 0}>运行分配</button>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;

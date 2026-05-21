import React, { useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { SAMPLE_DATA } from '../constants';

interface Props {
  onFileLoaded: (data: ArrayBuffer | string, fileName: string) => void;
  onUseSample: () => void;
}

function generateTemplate(): void {
  const wb = XLSX.utils.book_new();
  const data = [
    ['债权人名称', '债权金额', '抵押物名称', '抵押物评估值', '抵押权顺位'],
    ['甲', 500, '厂房A', 400, 1],
    ['乙', 300, '厂房A', 400, 1],
    ['甲', 200, '设备B', 250, 1],
    ['丙', 400, '设备B', 250, 1],
    ['丁', 600, '仓库C', 500, 2],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, '模板');
  XLSX.writeFile(wb, '担保物权数据模板.xlsx');
}

const FileUpload: React.FC<Props> = ({ onFileLoaded, onUseSample }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    if (file.name.endsWith('.csv')) {
      reader.onload = () => onFileLoaded(reader.result as string, file.name);
      reader.readAsText(file);
    } else {
      reader.onload = () => onFileLoaded(reader.result as ArrayBuffer, file.name);
      reader.readAsArrayBuffer(file);
    }
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className="upload-section">
      <div
        className="upload-dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="upload-title">拖拽文件到此处，或点击选择</p>
        <p className="upload-hint">支持 .xlsx、.xls、.csv 格式</p>
      </div>

      <div className="upload-actions-row">
        <button className="btn btn-secondary btn-sm" onClick={generateTemplate}>
          下载示例模板
        </button>
        <button className="btn btn-primary btn-sm" onClick={onUseSample}>
          加载示例数据
        </button>
      </div>

      <div className="upload-format-info">
        <h4>表格格式要求</h4>
        <p>必须包含以下五列（列名支持多种写法，系统自动识别）：</p>
        <table className="format-table">
          <thead>
            <tr><th>列名</th><th>说明</th><th>示例</th></tr>
          </thead>
          <tbody>
            <tr><td>债权人名称</td><td>唯一标识或名称</td><td>债权人A</td></tr>
            <tr><td>债权金额</td><td>对该抵押物的担保债权金额</td><td>500</td></tr>
            <tr><td>抵押物名称</td><td>抵押物唯一标识</td><td>物1</td></tr>
            <tr><td>抵押物评估值</td><td>该抵押物的评估价值</td><td>300</td></tr>
            <tr><td>抵押权顺位</td><td>1为最高，数值越大优先级越低</td><td>1</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileUpload;

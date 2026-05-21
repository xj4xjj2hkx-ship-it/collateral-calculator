import React, { useState, useCallback } from 'react';
import { AppStep, ParsedClaim, AllocationResult, ValidationError } from './types';
import { ValidationResult } from './utils/validation';
import { SAMPLE_DATA } from './constants';
import { parseFileToRows, mapRowsToClaims, detectColumnMapping } from './utils/fileParser';
import { validateClaims } from './utils/validation';
import { runAllocation } from './utils/allocationEngine';
import FileUpload from './components/FileUpload';
import DataPreview from './components/DataPreview';
import AllocationResults from './components/AllocationResults';
import ExplanationPanel from './components/ExplanationPanel';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedClaim[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ errors: [], warnings: [] });
  const [result, setResult] = useState<AllocationResult | null>(null);

  const handleFileLoaded = useCallback((data: ArrayBuffer | string, fileName: string) => {
    const { rows, headers } = parseFileToRows(data, fileName);
    const mapping = detectColumnMapping(headers);
    if (mapping) {
      const claims = mapRowsToClaims(rows, mapping);
      setParsedData(claims);
      setValidationResult(validateClaims(claims));
    } else {
      setParsedData([]);
      setValidationResult({
        errors: [{ row: 0, field: '表头', message: '无法自动识别列名，请确保包含：债权人名称、债权金额、抵押物名称、抵押物评估值、抵押权顺位' }],
        warnings: [],
      });
    }
    setStep('preview');
  }, []);

  const handleUseSample = useCallback(() => {
    setParsedData([...SAMPLE_DATA]);
    setValidationResult(validateClaims(SAMPLE_DATA));
    setStep('preview');
  }, []);

  const handleCellEdit = useCallback((index: number, field: keyof ParsedClaim, value: string | number) => {
    setParsedData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleDeleteRow = useCallback((index: number) => {
    setParsedData(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddRow = useCallback(() => {
    setParsedData(prev => [...prev, {
      creditorName: '',
      debtAmount: 0,
      collateralName: '',
      collateralValue: 0,
      priority: 1,
    }]);
  }, []);

  const handleCalculate = useCallback(() => {
    const vr = validateClaims(parsedData);
    setValidationResult(vr);
    const criticalErrors = vr.errors.filter(e =>
      e.message.includes('不能为空') || e.message.includes('必须大于') || e.message.includes('不一致')
    );
    if (criticalErrors.length > 0) return;

    const allocResult = runAllocation(parsedData);
    setResult(allocResult);
    setStep('results');
  }, [parsedData]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setParsedData([]);
    setValidationResult({ errors: [], warnings: [] });
    setResult(null);
  }, []);

  return (
    <div className="page-shell">
      <div className="page-glow" />

      {/* Hero */}
      <div className="hero-bar glass-card">
        <div className="hero-bar-left">
          <h1>抵质押物模拟分配器-FMY1.0</h1>
          <p>依据《民法典》第414条 · 排他物优先 + 按比例分配 · 同顺位最大化总回收额</p>
        </div>
        <div className="hero-bar-right">
          <span className="hero-badge">纯前端</span>
          <span className="hero-badge">数据不离开浏览器</span>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="main-layout">
        {/* Left: batch upload */}
        <div className="left-panel glass-card">
          <h2 className="panel-title">
            <span className="panel-icon">&#128202;</span>
            批量上传与计算
          </h2>

          {step === 'upload' && (
            <FileUpload onFileLoaded={handleFileLoaded} onUseSample={handleUseSample} />
          )}

          {step === 'preview' && (
            <DataPreview
              data={parsedData}
              validationResult={validationResult}
              onCellEdit={handleCellEdit}
              onDeleteRow={handleDeleteRow}
              onAddRow={handleAddRow}
              onCalculate={handleCalculate}
              onBack={() => setStep('upload')}
            />
          )}

          {step === 'results' && result && (
            <div className="left-results-hint">
              <p className="text-green">计算完成，请查看下方结果区域</p>
              <div className="left-results-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setStep('preview')}>返回编辑</button>
                <button className="btn btn-secondary btn-sm" onClick={handleReset}>重新上传</button>
              </div>
            </div>
          )}

          <div className="algo-brief">
            <h4>算法说明</h4>
            <p>
              不同顺位严格按高低分配；同一顺位内采用<strong>网络流最大流（Dinic算法）</strong>，
              在满足各担保物价值上限和各债权人分项债权上限的前提下，使该顺位全体债权人总回收额最大化。
            </p>
          </div>
        </div>

        {/* Right: simulator */}
        <div className="right-panel glass-card">
          <h2 className="panel-title">
            <span className="panel-icon">&#9881;</span>
            交互式规则模拟器
          </h2>
          <ExplanationPanel />
        </div>
      </div>

      {/* Bottom: results */}
      {step === 'results' && result && (
        <div className="bottom-results">
          <AllocationResults result={result} parsedClaims={parsedData} />
        </div>
      )}
    </div>
  );
};

export default App;

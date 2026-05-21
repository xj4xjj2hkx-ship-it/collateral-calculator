export function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿';
  }
  if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万';
  }
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[,，\s]/g, '').replace(/[万亿]/g, (match) => {
    return match === '亿' ? '00000000' : '0000';
  });
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

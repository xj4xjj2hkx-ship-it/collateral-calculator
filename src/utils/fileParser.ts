import * as XLSX from 'xlsx';
import { ColumnMapping, ParsedClaim } from '../types';
import { COLUMN_ALIASES } from '../constants';

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_]+/g, '');
}

function detectColumn(headers: string[], field: keyof ColumnMapping): string | null {
  const aliases = COLUMN_ALIASES[field].map(a => normalizeHeader(a));
  for (const h of headers) {
    if (aliases.includes(normalizeHeader(h))) {
      return h;
    }
  }
  return null;
}

export function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const mapping: Partial<ColumnMapping> = {};
  const fields: (keyof ColumnMapping)[] = ['creditorName', 'debtAmount', 'collateralName', 'collateralValue', 'priority'];

  for (const field of fields) {
    const detected = detectColumn(headers, field);
    if (!detected) return null;
    mapping[field] = detected;
  }

  return mapping as ColumnMapping;
}

export function parseFileToRows(data: ArrayBuffer | string, fileName: string): { rows: Record<string, string | number>[]; headers: string[] } {
  let workbook: XLSX.WorkBook;

  if (fileName.endsWith('.csv')) {
    workbook = XLSX.read(data as string, { type: 'string' });
  } else {
    workbook = XLSX.read(data as ArrayBuffer, { type: 'array' });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });

  if (rows.length === 0) {
    return { rows: [], headers: [] };
  }

  const headers = Object.keys(rows[0]);
  return { rows, headers };
}

export function mapRowsToClaims(
  rows: Record<string, string | number>[],
  mapping: ColumnMapping
): ParsedClaim[] {
  return rows.map(row => {
    const debtRaw = row[mapping.debtAmount];
    const valueRaw = row[mapping.collateralValue];
    const priorityRaw = row[mapping.priority];

    return {
      creditorName: String(row[mapping.creditorName] || '').trim(),
      debtAmount: typeof debtRaw === 'number' ? debtRaw : parseFloat(String(debtRaw).replace(/[,，\s]/g, '')) || 0,
      collateralName: String(row[mapping.collateralName] || '').trim(),
      collateralValue: typeof valueRaw === 'number' ? valueRaw : parseFloat(String(valueRaw).replace(/[,，\s]/g, '')) || 0,
      priority: typeof priorityRaw === 'number' ? priorityRaw : parseInt(String(priorityRaw), 10) || 1,
    };
  }).filter(row => row.creditorName && row.collateralName);
}

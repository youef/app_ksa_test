import { Platform } from 'react-native';

type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Prevent spreadsheet formula injection while preserving CSV quoting.
  const safe = /^[\\s\\uFEFF]*[=+\\-@]/.test(s) ? "'" + s : s;
  return /[",\\n\\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

/**
 * Builds an RFC-4180-ish CSV and triggers a browser download on web.
 * Returns true when a download was started, false on unsupported platforms.
 */
export function exportCsv(filename: string, headers: string[], rows: Cell[][]): boolean {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  const csv = '\uFEFF' + lines.join('\r\n');

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }
  return false;
}

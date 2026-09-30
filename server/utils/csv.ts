/**
 * Minimal RFC 4180 CSV writer for the admin ledger exports.
 * Cells starting with = + - @ TAB or CR are prefixed with a single quote so that opening an export in Excel / Google
 * Sheets can never execute a formula that a customer typed into a free-text field ("CSV injection").
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function csvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let s = typeof raw === 'string' ? raw : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
  if (/^[=+\-@\t\r]/.test(s) && !(typeof raw === 'number' && Number.isFinite(raw))) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  return lines.join('\r\n') + '\r\n';
}

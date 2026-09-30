/**
 * Pure helpers for the admin portal UI (query strings, pagination maths, labels, chart geometry, routing).
 * Kept free of React/DOM so they can be unit-tested with the rest of the suite.
 */

export const ADMIN_BASE_PATH = '/admin';

export type AdminSection =
  | 'dashboard' | 'users' | 'technicians' | 'jobs' | 'disputes' | 'payments' | 'refunds' | 'escrow' | 'payouts'
  | 'reviews' | 'risk' | 'audit' | 'announcements' | 'admins';

export const ADMIN_SECTIONS: { id: AdminSection; label: string; group: 'Overview' | 'People' | 'Operations' | 'Money' | 'Trust & safety' | 'System' }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { id: 'users', label: 'Users', group: 'People' },
  { id: 'technicians', label: 'Technicians & KYC', group: 'People' },
  { id: 'jobs', label: 'Repair jobs', group: 'Operations' },
  { id: 'disputes', label: 'Disputes', group: 'Operations' },
  { id: 'payments', label: 'Payments', group: 'Money' },
  { id: 'escrow', label: 'Escrow & earnings', group: 'Money' },
  { id: 'refunds', label: 'Refunds', group: 'Money' },
  { id: 'payouts', label: 'Payouts', group: 'Money' },
  { id: 'reviews', label: 'Reviews', group: 'Trust & safety' },
  { id: 'risk', label: 'Risk events', group: 'Trust & safety' },
  { id: 'announcements', label: 'Announcements', group: 'System' },
  { id: 'audit', label: 'Audit log', group: 'System' },
  { id: 'admins', label: 'Admins & security', group: 'System' },
];

export function isAdminPath(pathname: string | undefined | null): boolean {
  return typeof pathname === 'string' && (pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`));
}

/** "/admin/users" -> "users"; unknown or empty -> "dashboard". */
export function sectionFromPath(pathname: string): AdminSection {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0].toLowerCase();
  return (ADMIN_SECTIONS.find((s) => s.id === seg)?.id ?? 'dashboard') as AdminSection;
}

export function pathForSection(section: AdminSection): string {
  return section === 'dashboard' ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}/${section}`;
}

/** Drops empty values and encodes the rest; keys are sorted for stable URLs / cache keys. */
export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const v = params[key];
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export interface PageInfo {
  page: number; // 1-based
  pages: number;
  from: number; // 1-based index of the first row shown (0 when empty)
  to: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function pageInfo(total: number, limit: number, offset: number): PageInfo {
  const safeLimit = Math.max(1, Math.floor(limit) || 1);
  const safeTotal = Math.max(0, Math.floor(total) || 0);
  const safeOffset = Math.max(0, Math.floor(offset) || 0);
  const pages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const page = Math.min(pages, Math.floor(safeOffset / safeLimit) + 1);
  const from = safeTotal === 0 ? 0 : safeOffset + 1;
  const to = Math.min(safeTotal, safeOffset + safeLimit);
  return { page, pages, from, to, total: safeTotal, hasPrev: safeOffset > 0, hasNext: safeOffset + safeLimit < safeTotal };
}

export function offsetForPage(page: number, limit: number): number {
  return Math.max(0, (Math.max(1, Math.floor(page) || 1) - 1) * Math.max(1, Math.floor(limit) || 1));
}

/** After deleting/filtering the last row of the last page, step back to a page that exists. */
export function clampOffset(total: number, limit: number, offset: number): number {
  if (total <= 0) return 0;
  const lastPageOffset = Math.floor((total - 1) / limit) * limit;
  return Math.min(Math.max(0, offset), lastPageOffset);
}

/** "PAYMENT_PENDING" -> "Payment pending". */
export function labelize(value: string | undefined | null): string {
  if (!value) return '—';
  const s = String(value).replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "ADMIN_KYC_APPROVED" -> "KYC approved" (drops the ADMIN_ prefix, keeps acronyms readable). */
export function describeAuditAction(action: string): string {
  const base = labelize(String(action || '').replace(/^ADMIN_/, ''));
  return base.replace(/\b(kyc|otp|ngn|ip|id)\b/gi, (m) => m.toUpperCase());
}

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'violet';

const TONES: Record<string, Tone> = {
  // jobs
  COMPLETED: 'green', RELEASED_TO_TECHNICIAN: 'green', SUCCESS: 'green', ESCROW_HELD: 'blue', PAID_OUT: 'green', ELIGIBLE_FOR_PAYOUT: 'blue',
  REPAIR_IN_PROGRESS: 'blue', BOOKED: 'blue', PAYMENT_CONFIRMED: 'blue', DIAGNOSING: 'blue', READY_FOR_PICKUP: 'blue',
  PAYMENT_PENDING: 'amber', PENDING: 'amber', INITIATED: 'amber', PROCESSING: 'amber', HELD: 'amber', PARTIALLY_REFUNDED: 'amber',
  DISPUTED: 'red', FAILED: 'red', REJECTED: 'red', CANCELLED: 'slate', REFUNDED: 'violet', REVERSED: 'violet',
  // users / kyc
  active: 'green', suspended: 'red', VERIFIED: 'green', APPROVED: 'green', HIGH: 'red', MEDIUM: 'amber', LOW: 'slate',
};

export function statusTone(status: string | undefined | null): Tone {
  return (status && TONES[status]) || 'slate';
}

export const TONE_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

export interface TrendPoint { date: string; jobs: number; gmvNaira: number; newUsers: number }

/** SVG polyline geometry for a small trend chart. x spreads evenly, y is scaled to the series max (never divides by 0). */
export function chartGeometry(values: number[], width: number, height: number, pad = 4) {
  const n = values.length;
  const max = Math.max(1, ...values.map((v) => (Number.isFinite(v) ? v : 0)));
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const points = values.map((v, i) => ({
    x: pad + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: pad + innerH - ((Number.isFinite(v) ? v : 0) / max) * innerH,
    value: v,
  }));
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = n ? `${points[0].x.toFixed(1)},${(pad + innerH).toFixed(1)} ${line} ${points[n - 1].x.toFixed(1)},${(pad + innerH).toFixed(1)}` : '';
  return { points, line, area, max };
}

/** Horizontal bar widths (0–100) relative to the largest entry. */
export function barWidths(entries: { key: string; value: number }[]): { key: string; value: number; pct: number }[] {
  const max = Math.max(1, ...entries.map((e) => e.value));
  return entries.map((e) => ({ ...e, pct: Math.round((e.value / max) * 100) }));
}

/** Reads the filename from a Content-Disposition header, with a fallback. */
export function filenameFromDisposition(header: string | null | undefined, fallback: string): string {
  const m = /filename="?([^";]+)"?/i.exec(header || '');
  return m ? m[1] : fallback;
}

/** Client-side mirror of the server's requirement so the confirm dialog can disable Submit early. */
export function validateConfirmInput(opts: { needsReason: boolean; minReason?: number; needsPassword: boolean }, values: { reason: string; password: string }): string | null {
  if (opts.needsReason && values.reason.trim().length < (opts.minReason ?? 3)) return `Enter a reason (at least ${opts.minReason ?? 3} characters).`;
  if (opts.needsPassword && !values.password) return 'Enter your admin password to confirm.';
  return null;
}

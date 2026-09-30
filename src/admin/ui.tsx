import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { AdminApi, AdminApiError } from '../api/adminClient';
import { TONE_CLASSES, Tone, clampOffset, labelize, pageInfo, statusTone, validateConfirmInput } from '../utils/adminUi';
import { formatDateTime } from '../utils/format';

/* ------------------------------------------------------------------ context */

export interface AdminConfig {
  reauthRequired: boolean;
  payoutApprovalRequired: boolean;
  commissionPercent: number;
  environment: string;
  paymentMode: string;
}
export interface AdminCtx {
  me: { id: string; name: string; email: string };
  config: AdminConfig;
  toast: (message: string, kind?: 'success' | 'error') => void;
  navigate: (section: string) => void;
  signOut: () => void;
}
export const AdminContext = createContext<AdminCtx | null>(null);
export const useAdmin = (): AdminCtx => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin outside AdminContext');
  return ctx;
};

export function errorMessage(e: unknown): string {
  if (e instanceof AdminApiError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/* ------------------------------------------------------------------ small pieces */

export const Badge: React.FC<{ value?: string | null; tone?: Tone; label?: string }> = ({ value, tone, label }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE_CLASSES[tone || statusTone(value)]}`}>
    {label ?? labelize(value)}
  </span>
);

export const Card: React.FC<{ title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = '' }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {(title || action) && (
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {action}
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; small?: boolean }> = ({ variant = 'secondary', small, className = '', ...props }) => {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'} ${styles} ${className}`}
    />
  );
};

export const Spinner: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
  </div>
);

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div className="flex-1">{message}</div>
    {onRetry && <Btn small onClick={onRetry}><RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry</Btn>}
  </div>
);

export const Empty: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="py-10 text-center">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

export const KV: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-medium text-slate-800 break-words min-w-0">{children ?? '—'}</dd>
  </div>
);

export const Dt: React.FC<{ value?: string | null }> = ({ value }) => <span className="whitespace-nowrap">{value ? formatDateTime(value) : '—'}</span>;

/* ------------------------------------------------------------------ toasts */

export const Toasts: React.FC<{ items: { id: number; message: string; kind: 'success' | 'error' }[]; dismiss: (id: number) => void }> = ({ items, dismiss }) => (
  <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
    {items.map((t) => (
      <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-2 rounded-xl border p-3 text-sm shadow-lg ${t.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <span className="flex-1">{t.message}</span>
        <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-current opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ drawer & confirm dialog */

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [active, onClose]);
}

export const Drawer: React.FC<{ open: boolean; title: string; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: string }> = ({ open, title, subtitle, onClose, children, width = 'max-w-xl' }) => {
  useEscape(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`relative flex h-full w-full ${width} flex-col bg-slate-50 shadow-2xl focus:outline-none`}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close details" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};

export interface ConfirmSpec {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  needsReason?: boolean;
  reasonLabel?: string;
  reasonOptional?: boolean;
  /** extra inputs (e.g. refund amount, decision select) rendered above the reason */
  fields?: { key: string; label: string; type?: 'text' | 'number' | 'select' | 'textarea'; options?: { value: string; label: string }[]; placeholder?: string; defaultValue?: string; required?: boolean }[];
  /** false for actions the server does not gate behind the admin password */
  needsPassword?: boolean;
  run: (values: { reason: string; adminPassword: string; fields: Record<string, string> }) => Promise<unknown>;
}

export const ConfirmDialog: React.FC<{ spec: ConfirmSpec | null; onClose: (done?: boolean) => void }> = ({ spec, onClose }) => {
  const { config } = useAdmin();
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const first = useRef<HTMLElement | null>(null);
  useEscape(Boolean(spec) && !busy, () => onClose(false));

  useEffect(() => {
    if (spec) {
      setReason(''); setPassword(''); setErr(null); setBusy(false);
      setFields(Object.fromEntries((spec.fields || []).map((f) => [f.key, f.defaultValue ?? ''])));
      setTimeout(() => first.current?.focus(), 30);
    }
  }, [spec]);
  if (!spec) return null;

  const needsPassword = (spec.needsPassword ?? true) && config.reauthRequired;
  const needsReason = Boolean(spec.needsReason);
  const local = validateConfirmInput({ needsReason: needsReason && !spec.reasonOptional, needsPassword }, { reason, password })
    || (spec.fields || []).filter((f) => f.required && !fields[f.key]?.trim()).map((f) => `${f.label} is required.`)[0]
    || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (local) { setErr(local); return; }
    setBusy(true); setErr(null);
    try {
      await spec.run({ reason: reason.trim(), adminPassword: password, fields });
      onClose(true);
    } catch (ex) {
      setErr(errorMessage(ex));
      setBusy(false);
      setPassword('');
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !busy && onClose(false)} aria-hidden="true" />
      <form onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 id="confirm-title" className="text-base font-bold text-slate-900">{spec.title}</h2>
        {spec.description && <div className="mt-1 text-sm text-slate-600">{spec.description}</div>}
        <div className="mt-4 space-y-3">
          {(spec.fields || []).map((f, i) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{f.label}</span>
              {f.type === 'select' ? (
                <select ref={(el) => { if (i === 0) first.current = el; }} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} className={inputCls}>
                  {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea ref={(el) => { if (i === 0) first.current = el; }} value={fields[f.key] ?? ''} placeholder={f.placeholder} rows={3} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} className={inputCls} />
              ) : (
                <input ref={(el) => { if (i === 0) first.current = el; }} type={f.type === 'number' ? 'number' : 'text'} min={f.type === 'number' ? 1 : undefined} value={fields[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} className={inputCls} />
              )}
            </label>
          ))}
          {needsReason && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{spec.reasonLabel || 'Reason'}{spec.reasonOptional ? ' (optional)' : ''}</span>
              <textarea ref={(el) => { if (!(spec.fields || []).length) first.current = el; }} value={reason} rows={3} maxLength={500} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Recorded in the audit log" />
            </label>
          )}
          {needsPassword && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Your admin password</span>
              <input ref={(el) => { if (!needsReason && !(spec.fields || []).length) first.current = el; }} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <span className="mt-1 block text-xs text-slate-500">Re-enter your password to confirm this action.</span>
            </label>
          )}
        </div>
        {err && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Btn type="button" onClick={() => onClose(false)} disabled={busy}>Cancel</Btn>
          <Btn type="submit" variant={spec.danger ? 'danger' : 'primary'} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {spec.confirmLabel}
          </Btn>
        </div>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ data list */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** server sort key; the header becomes a sort toggle */
  sort?: string;
  align?: 'right';
}

export interface FilterDef {
  key: string;
  label: string;
  type: 'select' | 'date';
  options?: { value: string; label: string }[];
}

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function DataList<T extends { id?: string }>({
  path, columns, filters = [], initialFilters = {}, searchPlaceholder = 'Search…', onRowClick, exportLedger, defaultSort, refreshKey = 0, toolbar, emptyTitle = 'Nothing here yet', pageSize = 25, rowKey,
}: {
  path: string;
  columns: Column<T>[];
  filters?: FilterDef[];
  initialFilters?: Record<string, string>;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  exportLedger?: string;
  defaultSort?: { sort: string; order: 'asc' | 'desc' };
  refreshKey?: number;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  pageSize?: number;
  rowKey?: (row: T) => string;
}) {
  const { toast } = useAdmin();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [fv, setFv] = useState<Record<string, string>>(initialFilters);
  const [sort, setSort] = useState(defaultSort);
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<{ items: T[]; total: number; loading: boolean; error: string | null }>({ items: [], total: 0, loading: true, error: null });
  const [exporting, setExporting] = useState(false);
  const [nonce, setNonce] = useState(0);

  const query = useMemo(() => ({ q: dq, ...fv, sort: sort?.sort, order: sort?.order, limit: pageSize, offset }), [dq, fv, sort, pageSize, offset]);

  useEffect(() => { setOffset(0); }, [dq, fv, sort]);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    AdminApi.list<T>(path, query as any)
      .then((page) => {
        if (cancelled) return;
        const clamped = clampOffset(page.total, pageSize, offset);
        if (clamped !== offset) { setOffset(clamped); return; }
        setState({ items: page.items, total: page.total, loading: false, error: null });
      })
      .catch((e) => { if (!cancelled) setState((s) => ({ ...s, loading: false, error: errorMessage(e) })); });
    return () => { cancelled = true; };
  }, [path, query, refreshKey, nonce, pageSize, offset]);

  const info = pageInfo(state.total, pageSize, offset);
  const setFilter = (k: string, v: string) => setFv((cur) => ({ ...cur, [k]: v }));
  const toggleSort = (key: string) => setSort((cur) => (cur?.sort === key ? { sort: key, order: cur.order === 'asc' ? 'desc' : 'asc' } : { sort: key, order: 'desc' }));

  const doExport = async () => {
    setExporting(true);
    try {
      const name = await AdminApi.downloadCsv(exportLedger!, { q: dq, ...fv });
      toast(`Exported ${name}`);
    } catch (e) { toast(errorMessage(e), 'error'); } finally { setExporting(false); }
  };

  const inputCls = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
  const [first, ...rest] = columns;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[180px] flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className={`${inputCls} w-full pl-9`} />
        </label>
        {filters.map((f) => (
          <label key={f.key} className="text-xs font-medium text-slate-500">
            <span className="mb-0.5 block">{f.label}</span>
            {f.type === 'select' ? (
              <select value={fv[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)} className={inputCls}>
                <option value="">All</option>
                {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type="date" value={fv[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)} className={inputCls} />
            )}
          </label>
        ))}
        <Btn onClick={() => setNonce((n) => n + 1)} aria-label="Refresh list"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} aria-hidden="true" /></Btn>
        {exportLedger && <Btn onClick={doExport} disabled={exporting}><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</Btn>}
        {toolbar}
      </div>

      {state.error && <ErrorBox message={state.error} onRetry={() => setNonce((n) => n + 1)} />}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {state.loading && state.items.length === 0 ? (
          <Spinner />
        ) : state.items.length === 0 && !state.error ? (
          <Empty title={dq || Object.values(fv).some(Boolean) ? 'No results match your search or filters' : emptyTitle} hint={dq || Object.values(fv).some(Boolean) ? 'Try clearing a filter.' : undefined} />
        ) : (
          <>
            {/* wide screens: a real table */}
            <div className={`hidden overflow-x-auto md:block ${state.loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} scope="col" className={`px-4 py-2.5 font-semibold ${c.align === 'right' ? 'text-right' : ''}`} aria-sort={c.sort && sort?.sort === c.sort ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {c.sort ? (
                          <button onClick={() => toggleSort(c.sort!)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
                            {c.header}{sort?.sort === c.sort ? (sort.order === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        ) : c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.items.map((row, i) => (
                    <tr
                      key={rowKey ? rowKey(row) : row.id ?? i}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      className={onRowClick ? 'cursor-pointer hover:bg-blue-50/50 focus:bg-blue-50/70 focus:outline-none' : ''}
                    >
                      {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render(row)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* phones: stacked cards */}
            <ul className={`divide-y divide-slate-100 md:hidden ${state.loading ? 'opacity-60' : ''}`}>
              {state.items.map((row, i) => (
                <li key={rowKey ? rowKey(row) : row.id ?? i}>
                  <div
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                    className="space-y-1.5 px-4 py-3 active:bg-slate-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{first.render(row)}</div>
                    {rest.map((c) => (
                      <div key={c.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500">{c.header}</span>
                        <span className="text-right text-slate-800">{c.render(row)}</span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          <span aria-live="polite">{info.total === 0 ? 'No rows' : `Showing ${info.from}–${info.to} of ${info.total.toLocaleString('en-NG')}`}</span>
          <span className="flex items-center gap-2">
            <Btn small onClick={() => setOffset(Math.max(0, offset - pageSize))} disabled={!info.hasPrev} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Btn>
            <span>Page {info.page} of {info.pages}</span>
            <Btn small onClick={() => setOffset(offset + pageSize)} disabled={!info.hasNext} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></Btn>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Loads a detail resource for a drawer and exposes a reload. */
export function useDetail<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: false, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    AdminApi.get<T>(path)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ data: null, loading: false, error: errorMessage(e) }); });
    return () => { cancelled = true; };
  }, [path, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

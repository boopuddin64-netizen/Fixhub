import { safeStorage } from '../utils/safeStorage';
import { buildQueryString, filenameFromDisposition } from '../utils/adminUi';

const API_BASE = '/api/admin';
// A different key from the customer/technician session: an admin token never leaks into (or out of) the marketplace app.
export const ADMIN_TOKEN_KEY = 'fixhub_admin_token';

export class AdminApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly retryAfterSec?: number;
  constructor(message: string, status: number, code?: string, retryAfterSec?: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export interface AdminPage<T> { items: T[]; total: number; limit: number; offset: number }

type QueryParams = Record<string, string | number | boolean | undefined | null>;

let unauthorizedHandler: (() => void) | null = null;
let passwordChangeHandler: (() => void) | null = null;

export const AdminApi = {
  getToken: (): string | null => safeStorage.getItem(ADMIN_TOKEN_KEY),
  setToken: (t: string) => safeStorage.setItem(ADMIN_TOKEN_KEY, t),
  clearToken: () => safeStorage.removeItem(ADMIN_TOKEN_KEY),
  onUnauthorized: (fn: (() => void) | null) => { unauthorizedHandler = fn; },
  onPasswordChangeRequired: (fn: (() => void) | null) => { passwordChangeHandler = fn; },

  async raw(method: string, path: string, body?: unknown, query?: QueryParams): Promise<Response> {
    const token = AdminApi.getToken();
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}${query ? buildQueryString(query) : ''}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AdminApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK');
    }
    if (!res.ok) {
      let payload: any = null;
      try { payload = await res.json(); } catch { /* not json */ }
      const err = new AdminApiError(payload?.error || `Request failed (${res.status}).`, res.status, payload?.code, payload?.retryAfterSec);
      // 401 on the login call itself is just "wrong password" - only an expired/revoked session signs the admin out.
      if (res.status === 401 && path !== '/auth/login') unauthorizedHandler?.();
      if (res.status === 403 && payload?.code === 'PASSWORD_CHANGE_REQUIRED') passwordChangeHandler?.();
      throw err;
    }
    return res;
  },

  async get<T>(path: string, query?: QueryParams): Promise<T> {
    return (await AdminApi.raw('GET', path, undefined, query)).json();
  },

  async list<T>(path: string, query?: QueryParams): Promise<AdminPage<T>> {
    const res = await AdminApi.raw('GET', path, undefined, query);
    const items = (await res.json()) as T[];
    return {
      items: Array.isArray(items) ? items : [],
      total: Number(res.headers.get('X-Total-Count') ?? (Array.isArray(items) ? items.length : 0)),
      limit: Number(res.headers.get('X-Limit') ?? 25),
      offset: Number(res.headers.get('X-Offset') ?? 0),
    };
  },

  async post<T>(path: string, body: unknown = {}): Promise<T> {
    return (await AdminApi.raw('POST', path, body)).json();
  },

  async del<T>(path: string, body: unknown = {}): Promise<T> {
    return (await AdminApi.raw('DELETE', path, body)).json();
  },

  /** Authenticated CSV download (a plain <a href> cannot send the bearer token). */
  async downloadCsv(ledger: string, query?: QueryParams): Promise<string> {
    const res = await AdminApi.raw('GET', `/export/${ledger}.csv`, undefined, query);
    const blob = await res.blob();
    const name = filenameFromDisposition(res.headers.get('Content-Disposition'), `fixhub-${ledger}.csv`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return name;
  },
};

import type { Request, Response } from 'express';

/**
 * Backward-compatible pagination for list endpoints.
 *
 * The response body stays a plain JSON array (existing clients keep working). `?limit=` / `?offset=` select a
 * window; without them the first `defaultLimit` items are returned, and `limit` can never exceed `maxLimit`, so no
 * endpoint returns an unbounded list any more. Paging metadata is sent in headers:
 *   X-Total-Count, X-Limit, X-Offset (exposed to browsers through CORS `exposedHeaders`).
 */
export const DEFAULT_PAGE_LIMIT = 200;
export const MAX_PAGE_LIMIT = 500;

export interface PageWindow {
  limit: number;
  offset: number;
}

function toInt(raw: unknown): number | null {
  if (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw.trim())) return null;
  return parseInt(raw.trim(), 10);
}

export function parsePagination(
  query: Request['query'],
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): PageWindow {
  const maxLimit = opts.maxLimit ?? MAX_PAGE_LIMIT;
  const defaultLimit = Math.min(opts.defaultLimit ?? DEFAULT_PAGE_LIMIT, maxLimit);
  const limitRaw = toInt(query?.limit);
  const offsetRaw = toInt(query?.offset);
  const limit = limitRaw === null ? defaultLimit : Math.min(Math.max(limitRaw, 1), maxLimit);
  const offset = offsetRaw === null ? 0 : offsetRaw;
  return { limit, offset };
}

/** Applies the window to `items`, sets the X-* headers on `res` and returns the page. */
export function paginate<T>(
  req: Request,
  res: Response,
  items: T[],
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): T[] {
  const { limit, offset } = parsePagination(req.query, opts);
  res.setHeader('X-Total-Count', String(items.length));
  res.setHeader('X-Limit', String(limit));
  res.setHeader('X-Offset', String(offset));
  return items.slice(offset, offset + limit);
}

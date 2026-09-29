import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { RequestHandler } from 'express';
import { parseAllowedOrigins } from './cors';

/**
 * Content-Security-Policy for the production build (Vite bundle served from dist/).
 *
 * Third parties covered:
 *  - Google Sign-In (accounts.google.com/gsi: script, button iframe, styles, token XHR)
 *  - Google Maps JS API / Places / Geocoding (maps.googleapis.com, maps.gstatic.com, tiles as img)
 *  - Paystack (js.paystack.co / checkout.paystack.com; the app itself redirects to the hosted checkout)
 *  - Nominatim reverse geocoding fallback (client-side fetch)
 *
 * The one inline <script> in index.html is allowed by SHA-256 hash (computed from dist/index.html at boot),
 * so 'unsafe-inline' is NOT needed for scripts. Styles keep 'unsafe-inline' (React style="" attributes,
 * Google Maps and Tailwind injected styles).
 *
 * CSP_MODE: "enforce" | "report-only" (default in production) | "off". Development (Vite dev server, which
 * injects inline scripts + HMR websocket) never sends a CSP.
 */
export type CspMode = 'enforce' | 'report-only' | 'off';

export function resolveCspMode(env: NodeJS.ProcessEnv = process.env): CspMode {
  if (env.NODE_ENV !== 'production') return 'off';
  const raw = (env.CSP_MODE || '').trim().toLowerCase();
  if (raw === 'enforce' || raw === 'off') return raw;
  return 'report-only';
}

/** SHA-256 CSP source expressions for every inline (non-src) <script> in an HTML document. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1]) || !m[2].trim()) continue;
    if (/type\s*=\s*["'](?!module|text\/javascript)/i.test(m[1])) continue; // json/importmap etc. are not executed
    hashes.push(`'sha256-${crypto.createHash('sha256').update(m[2]).digest('base64')}'`);
  }
  return hashes;
}

export function buildCspDirectives(
  env: NodeJS.ProcessEnv = process.env,
  inlineHashes: string[] = []
): Record<string, string[]> {
  const frameAncestors = ["'self'", ...parseAllowedOrigins(env).filter((o) => !o.includes('*'))];
  const extra = (env.CSP_FRAME_ANCESTORS || '').split(/[\s,]+/).filter(Boolean);
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'script-src': [
      "'self'",
      ...inlineHashes,
      'https://accounts.google.com/gsi/client',
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://js.paystack.co',
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style', 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'], // avatars (unsplash, dicebear), Google Maps tiles, Paystack logos
    'media-src': ["'self'", 'data:', 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'connect-src': [
      "'self'",
      'https://accounts.google.com/gsi/',
      'https://oauth2.googleapis.com',
      'https://www.googleapis.com',
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://places.googleapis.com',
      'https://nominatim.openstreetmap.org',
      'https://api.paystack.co',
      'https://checkout.paystack.com',
    ],
    'frame-src': [
      'https://accounts.google.com/gsi/',
      'https://www.google.com',
      'https://checkout.paystack.com',
      'https://js.paystack.co',
    ],
    'form-action': ["'self'", 'https://checkout.paystack.com'],
    'frame-ancestors': Array.from(new Set([...frameAncestors, ...extra])),
    'report-uri': ['/api/csp-report'],
  };
}

export function serializeCsp(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

/** Middleware that sets the CSP header (enforcing or report-only) for HTML/asset responses. */
export function buildCspMiddleware(
  env: NodeJS.ProcessEnv = process.env,
  distIndexHtmlPath: string = path.join(process.cwd(), 'dist', 'index.html')
): RequestHandler | null {
  const mode = resolveCspMode(env);
  if (mode === 'off') return null;
  let hashes: string[] = [];
  try {
    hashes = inlineScriptHashes(fs.readFileSync(distIndexHtmlPath, 'utf8'));
  } catch {
    console.warn(`[csp] ${distIndexHtmlPath} not found; inline scripts will be blocked by the CSP.`);
  }
  const value = serializeCsp(buildCspDirectives(env, hashes));
  const header = mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  console.log(`[csp] ${mode} mode (${hashes.length} inline script hash(es)).`);
  return (_req, res, next) => {
    res.setHeader(header, value);
    next();
  };
}

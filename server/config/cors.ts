import type { CorsOptions } from 'cors';

/**
 * CORS allow-list.
 *
 * Allowed origins = ALLOWED_ORIGINS (comma-separated; exact origins such as https://app.example.com, or
 * `https://*.example.com` wildcard-subdomain entries) + the origin of APP_URL.
 * Outside production, http(s)://localhost and 127.0.0.1 (any port) are also allowed for local development.
 * Requests without an Origin header (same-origin navigation, curl, server-to-server, native mobile) are
 * not CORS requests and are unaffected. Any other origin simply gets no CORS headers (browser blocks it);
 * we never reflect an arbitrary origin, and never with credentials.
 */
export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const list = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .filter((o) => o !== '*'); // a bare wildcard would defeat the allow-list; ignored on purpose
  if (env.APP_URL) {
    try {
      list.push(new URL(env.APP_URL).origin);
    } catch {
      /* placeholder like MY_APP_URL */
    }
  }
  return Array.from(new Set(list));
}

export function isOriginAllowed(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin) return true;
  const allowed = parseAllowedOrigins(env);
  if (allowed.includes(origin)) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  for (const entry of allowed) {
    const m = entry.match(/^(https?):\/\/\*\.(.+)$/i);
    if (m && parsed.protocol === `${m[1].toLowerCase()}:` && parsed.hostname.toLowerCase().endsWith(`.${m[2].toLowerCase()}`)) {
      return true;
    }
  }

  if (env.NODE_ENV !== 'production') {
    const host = parsed.hostname.toLowerCase();
    if ((host === 'localhost' || host === '127.0.0.1' || host === '[::1]') && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      return true;
    }
  }
  return false;
}

export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  return {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin, env)),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Total-Count', 'X-Limit', 'X-Offset'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  };
}

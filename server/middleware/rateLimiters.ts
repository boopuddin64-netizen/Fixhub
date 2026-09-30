import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for sensitive payment initialization and verification endpoints.
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many payment requests from this IP, please try again after a minute.' },
});

/**
 * Rate limiter for incoming webhook traffic.
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 webhook events per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Webhook rate limit exceeded.' },
});

/**
 * Rate limiter for authentication attempts (login, registration).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many authentication attempts, please try again in a few minutes.' },
});

/**
 * Strict limiter for endpoints that accept a short numeric code (email/phone verification,
 * password-reset code, ...). A 6-digit code has only 1M possibilities, so guesses are capped hard.
 * Failed AND successful requests count on purpose (a legitimate user needs 1-3 tries).
 */
export const codeAttemptRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many verification attempts. Please wait 15 minutes and try again.' },
});

/**
 * Limiter for endpoints that trigger an outbound code/SMS/email (cost + harassment vector).
 */
export const codeSendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many code requests. Please wait a few minutes and try again.' },
});

/** CSP violation reports come from browsers unauthenticated; keep the log volume bounded. */
export const cspReportRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many reports.' },
});

/**
 * Admin sign-in: much stricter than the public login limiter. Only FAILED attempts count, so a legitimate admin is never
 * locked out by their own successful sessions; on top of this every admin account has its own lockout
 * (server/services/adminAuthService.ts) so rotating IPs does not help an attacker either.
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many admin sign-in attempts. Please wait 15 minutes and try again.' },
});

/** Generic ceiling for the whole /api/admin surface (authenticated admins only ever reach a fraction of it). */
export const adminApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many admin requests. Please slow down.' },
});

/** Bulk operations (CSV exports, announcements) are expensive: a low ceiling per IP. */
export const adminBulkRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many export/broadcast requests. Please wait a minute.' },
});

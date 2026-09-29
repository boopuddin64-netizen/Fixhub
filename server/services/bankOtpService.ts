import crypto from 'crypto';

/**
 * Bank-change one-time codes.
 *
 * State lives in a private in-process store keyed by technician id — never on the technician profile
 * object — so the code can't leak through any API response that serialises the profile
 * (e.g. POST /technicians/verify/government-id, PUT /technicians/profile, GET /auth/me).
 * Codes are generated with crypto.randomInt, expire after 10 minutes, allow a limited number of
 * wrong guesses, and are compared in constant time.
 */
export const BANK_OTP_TTL_MS = 10 * 60 * 1000;
export const BANK_OTP_MAX_ATTEMPTS = 5;
export const BANK_OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const BANK_OTP_VERIFIED_WINDOW_MS = 30 * 60 * 1000;

interface OtpState {
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  verified: boolean;
  verifiedAt?: number;
}

const store = new Map<string, OtpState>();

export interface IssueResult { ok: boolean; code?: string; retryAfterSeconds?: number }
export interface VerifyResult { ok: boolean; reason?: 'NO_REQUEST' | 'EXPIRED' | 'LOCKED' | 'INCORRECT'; attemptsLeft?: number }

export const BankOtpService = {
  issue(technicianId: string, now = Date.now()): IssueResult {
    const existing = store.get(technicianId);
    if (existing && !existing.verified && now - existing.createdAt < BANK_OTP_RESEND_COOLDOWN_MS) {
      return { ok: false, retryAfterSeconds: Math.ceil((BANK_OTP_RESEND_COOLDOWN_MS - (now - existing.createdAt)) / 1000) };
    }
    const code = crypto.randomInt(100000, 1000000).toString();
    store.set(technicianId, { code, expiresAt: now + BANK_OTP_TTL_MS, attempts: 0, createdAt: now, verified: false });
    return { ok: true, code };
  },

  verify(technicianId: string, submitted: unknown, now = Date.now()): VerifyResult {
    const state = store.get(technicianId);
    if (!state || state.verified) return { ok: false, reason: 'NO_REQUEST' };
    if (now > state.expiresAt) {
      store.delete(technicianId);
      return { ok: false, reason: 'EXPIRED' };
    }
    if (state.attempts >= BANK_OTP_MAX_ATTEMPTS) {
      store.delete(technicianId);
      return { ok: false, reason: 'LOCKED' };
    }
    const a = Buffer.from(String(submitted ?? '').trim().padEnd(6, ' ').slice(0, 64));
    const b = Buffer.from(state.code.padEnd(6, ' '));
    const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!equal) {
      state.attempts += 1;
      if (state.attempts >= BANK_OTP_MAX_ATTEMPTS) {
        store.delete(technicianId); // code is burned: a fresh one must be requested
        return { ok: false, reason: 'LOCKED' };
      }
      return { ok: false, reason: 'INCORRECT', attemptsLeft: BANK_OTP_MAX_ATTEMPTS - state.attempts };
    }
    state.verified = true;
    state.verifiedAt = now;
    return { ok: true };
  },

  /** True while a successfully verified code is still inside its 30-minute unlock window. */
  isUnlocked(technicianId: string, now = Date.now()): boolean {
    const state = store.get(technicianId);
    return !!state && state.verified && now - (state.verifiedAt || 0) < BANK_OTP_VERIFIED_WINDOW_MS;
  },

  clear(technicianId: string): void {
    store.delete(technicianId);
  },

  /** test helper */
  _peek(technicianId: string): OtpState | undefined {
    return store.get(technicianId);
  },
};

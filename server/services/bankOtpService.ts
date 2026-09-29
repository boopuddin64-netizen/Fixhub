import crypto from 'crypto';
import { db, BankOtpState } from '../db';
import { getJwtSecret } from './authService';

/**
 * Bank-change one-time codes.
 *
 * State lives in a private in-process store keyed by technician id — never on the technician profile
 * object — so the code can't leak through any API response that serialises the profile
 * (e.g. POST /technicians/verify/government-id, PUT /technicians/profile, GET /auth/me).
 * Codes are generated with crypto.randomInt, expire after 10 minutes, allow a limited number of
 * wrong guesses, and are compared in constant time.
 *
 * Durability: the state map lives on `db.bankOtps` and is mirrored to the `bank_otps` table (write-through,
 * committed before the HTTP response is sent), so a restart or a second process cannot be used to reset the
 * attempt counter or resurrect a burned code. Only an HMAC of the code is stored, never the code itself.
 */
export const BANK_OTP_TTL_MS = 10 * 60 * 1000;
export const BANK_OTP_MAX_ATTEMPTS = 5;
export const BANK_OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const BANK_OTP_VERIFIED_WINDOW_MS = 30 * 60 * 1000;

type OtpState = BankOtpState;

// NB: `db.bankOtps` is replaced by db.init(); always go through this accessor.
const getStore = (): Map<string, OtpState> => db.bankOtps;

function hashCode(technicianId: string, code: string): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(`bank-otp:${technicianId}:${code}`).digest('hex');
}

function persist(technicianId: string): void {
  const st = getStore().get(technicianId);
  if (!st) {
    db.queueWrite('DELETE FROM bank_otps WHERE technician_id = $1', [technicianId]);
    return;
  }
  db.queueWrite(
    `INSERT INTO bank_otps (technician_id, code_hash, attempts, verified, created_at_ms, expires_at_ms, verified_at_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (technician_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, attempts = EXCLUDED.attempts,
       verified = EXCLUDED.verified, created_at_ms = EXCLUDED.created_at_ms, expires_at_ms = EXCLUDED.expires_at_ms,
       verified_at_ms = EXCLUDED.verified_at_ms`,
    [technicianId, st.codeHash, st.attempts, st.verified, st.createdAt, st.expiresAt, st.verifiedAt ?? null]
  );
}

export interface IssueResult { ok: boolean; code?: string; retryAfterSeconds?: number }
export interface VerifyResult { ok: boolean; reason?: 'NO_REQUEST' | 'EXPIRED' | 'LOCKED' | 'INCORRECT'; attemptsLeft?: number }

export const BankOtpService = {
  issue(technicianId: string, now = Date.now()): IssueResult {
    const existing = getStore().get(technicianId);
    if (existing && !existing.verified && now - existing.createdAt < BANK_OTP_RESEND_COOLDOWN_MS) {
      return { ok: false, retryAfterSeconds: Math.ceil((BANK_OTP_RESEND_COOLDOWN_MS - (now - existing.createdAt)) / 1000) };
    }
    const code = crypto.randomInt(100000, 1000000).toString();
    getStore().set(technicianId, { codeHash: hashCode(technicianId, code), expiresAt: now + BANK_OTP_TTL_MS, attempts: 0, createdAt: now, verified: false });
    persist(technicianId);
    return { ok: true, code };
  },

  verify(technicianId: string, submitted: unknown, now = Date.now()): VerifyResult {
    const state = getStore().get(technicianId);
    if (!state || state.verified) return { ok: false, reason: 'NO_REQUEST' };
    if (now > state.expiresAt) {
      getStore().delete(technicianId);
      persist(technicianId);
      return { ok: false, reason: 'EXPIRED' };
    }
    if (state.attempts >= BANK_OTP_MAX_ATTEMPTS) {
      getStore().delete(technicianId);
      persist(technicianId);
      return { ok: false, reason: 'LOCKED' };
    }
    const a = Buffer.from(hashCode(technicianId, String(submitted ?? '').trim().slice(0, 64)));
    const b = Buffer.from(state.codeHash);
    const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!equal) {
      state.attempts += 1;
      if (state.attempts >= BANK_OTP_MAX_ATTEMPTS) {
        getStore().delete(technicianId); // code is burned: a fresh one must be requested
        persist(technicianId);
        return { ok: false, reason: 'LOCKED' };
      }
      persist(technicianId);
      return { ok: false, reason: 'INCORRECT', attemptsLeft: BANK_OTP_MAX_ATTEMPTS - state.attempts };
    }
    state.verified = true;
    state.verifiedAt = now;
    persist(technicianId);
    return { ok: true };
  },

  /** True while a successfully verified code is still inside its 30-minute unlock window. */
  isUnlocked(technicianId: string, now = Date.now()): boolean {
    const state = getStore().get(technicianId);
    return !!state && state.verified && now - (state.verifiedAt || 0) < BANK_OTP_VERIFIED_WINDOW_MS;
  },

  clear(technicianId: string): void {
    getStore().delete(technicianId);
    persist(technicianId);
  },

  /** test helper */
  _peek(technicianId: string): OtpState | undefined {
    return getStore().get(technicianId);
  },
};

import crypto from 'crypto';
import { db, VerificationCodeState } from '../db';
import { getJwtSecret } from './authService';

/**
 * Durable storage for password-reset, e-mail-verification and phone-verification codes.
 *
 * Same approach as bank_otps: the working copy is `db.verificationCodes` (a Map) which is mirrored to the
 * `verification_codes` table (write-through, committed before the HTTP response is sent) and reloaded by
 * db.init(). Only an HMAC (keyed with the JWT secret) of the code is ever stored — never the code itself —
 * so a database leak does not reveal usable codes, and codes survive a restart / redeploy.
 *
 *  - reset & email codes are looked up BY the code: the row key is the HMAC of `purpose:code`.
 *  - phone codes are looked up by user id or phone number (several keys can point at the same record); the
 *    submitted code is compared with the stored HMAC in constant time.
 */
export type CodePurpose = VerificationCodeState['purpose'];

const store = (): Map<string, VerificationCodeState> => db.verificationCodes;
const mapKey = (purpose: CodePurpose, codeKey: string) => `${purpose}:${codeKey}`;

function hmac(data: string): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(data).digest('hex');
}

function persist(state: VerificationCodeState): void {
  db.queueWrite(
    `INSERT INTO verification_codes (purpose, code_key, code_hash, user_id, email, phone, created_at_ms, expires_at_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (purpose, code_key) DO UPDATE SET code_hash = EXCLUDED.code_hash, user_id = EXCLUDED.user_id,
       email = EXCLUDED.email, phone = EXCLUDED.phone, created_at_ms = EXCLUDED.created_at_ms,
       expires_at_ms = EXCLUDED.expires_at_ms`,
    [state.purpose, state.codeKey, state.codeHash, state.userId ?? null, state.email ?? null, state.phone ?? null, state.createdAt, state.expiresAt]
  );
}

function remove(purpose: CodePurpose, codeKey: string): void {
  store().delete(mapKey(purpose, codeKey));
  db.queueWrite('DELETE FROM verification_codes WHERE purpose = $1 AND code_key = $2', [purpose, codeKey]);
}

function prune(now: number): void {
  for (const [k, v] of store()) {
    if (v.expiresAt < now) {
      store().delete(k);
      db.queueWrite('DELETE FROM verification_codes WHERE purpose = $1 AND code_key = $2', [v.purpose, v.codeKey]);
    }
  }
}

export interface CodeData { userId?: string; email?: string; phone?: string }

export const VerificationCodeService = {
  /** Reset / e-mail codes: stored under HMAC(purpose:code). */
  issueByCode(purpose: 'reset' | 'email', code: string, data: CodeData, ttlMs: number, now = Date.now()): void {
    prune(now);
    const codeKey = hmac(`${purpose}:${code}`);
    const state: VerificationCodeState = { purpose, codeKey, codeHash: codeKey, ...data, createdAt: now, expiresAt: now + ttlMs };
    store().set(mapKey(purpose, codeKey), state);
    persist(state);
  },

  /** Returns the live record for this code, or undefined (unknown / expired). Does not consume it. */
  findByCode(purpose: 'reset' | 'email', code: string, now = Date.now()): VerificationCodeState | undefined {
    const codeKey = hmac(`${purpose}:${String(code)}`);
    const state = store().get(mapKey(purpose, codeKey));
    if (!state) return undefined;
    if (state.expiresAt < now) {
      remove(purpose, codeKey);
      return undefined;
    }
    return state;
  },

  consumeByCode(purpose: 'reset' | 'email', code: string): void {
    remove(purpose, hmac(`${purpose}:${String(code)}`));
  },

  /** Phone codes: one record reachable under several lookup keys (user id, normalised phone number). */
  issuePhone(keys: string[], code: string, data: { userId?: string; phone: string }, ttlMs: number, now = Date.now()): void {
    prune(now);
    for (const key of Array.from(new Set(keys.filter(Boolean)))) {
      const state: VerificationCodeState = {
        purpose: 'phone',
        codeKey: key,
        codeHash: hmac(`phone:${data.phone}:${code}`),
        userId: data.userId,
        phone: data.phone,
        createdAt: now,
        expiresAt: now + ttlMs,
      };
      store().set(mapKey('phone', key), state);
      persist(state);
    }
  },

  /** First live record found under any of `keys` (in order). */
  findPhone(keys: Array<string | undefined>, now = Date.now()): VerificationCodeState | undefined {
    for (const key of keys) {
      if (!key) continue;
      const state = store().get(mapKey('phone', key));
      if (!state) continue;
      if (state.expiresAt < now) {
        remove('phone', key);
        continue;
      }
      return state;
    }
    return undefined;
  },

  phoneCodeMatches(state: VerificationCodeState, submitted: string): boolean {
    const a = Buffer.from(hmac(`phone:${state.phone}:${String(submitted).trim()}`));
    const b = Buffer.from(state.codeHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  deletePhone(keys: Array<string | undefined>): void {
    for (const key of keys) if (key) remove('phone', key);
  },
};

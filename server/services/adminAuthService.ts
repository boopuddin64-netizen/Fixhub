import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { AuthService } from './authService';
import { User } from '../../src/types/index';
import { validateAdminPassword, ADMIN_PASSWORD_MIN_LENGTH } from '../../src/utils/adminPasswordPolicy';
import { normalizeNgPhone } from '../../src/utils/format';

/** Consecutive wrong passwords (login OR re-authentication) before an admin account is locked. */
export const ADMIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOCK_MS = 15 * 60 * 1000;
const BCRYPT_COST = 12;

let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('fixhub-admin-dummy-password', BCRYPT_COST));

type StoredUser = User & { passwordHash: string; adminFailedLogins?: number; adminLockedUntil?: number; sessionVersion?: number };

// (The project does not compile with strictNullChecks, so discriminated unions on a boolean do not narrow: flat types.)
export interface AdminLoginResult {
  ok: boolean;
  token?: string;
  user?: User;
  mustChangePassword?: boolean;
  status?: 401;
  error?: string;
  code?: string;
  retryAfterSec?: number;
  adminId?: string;
}

export interface AdminConfirmResult {
  ok: boolean;
  reason?: 'INVALID' | 'LOCKED' | 'NO_PASSWORD';
  retryAfterSec?: number;
}

/** Whether destructive admin actions demand the admin's password again (default yes; ADMIN_REQUIRE_REAUTH=false disables). */
export function adminReauthRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return !/^(0|false|off|no)$/i.test((env.ADMIN_REQUIRE_REAUTH || '').trim());
}

function lockRemainingSec(user: StoredUser, now = Date.now()): number {
  return user.adminLockedUntil && user.adminLockedUntil > now ? Math.ceil((user.adminLockedUntil - now) / 1000) : 0;
}

function registerFailure(user: StoredUser, now = Date.now()): { locked: boolean } {
  // A lock that already expired starts a fresh counter.
  if (user.adminLockedUntil && user.adminLockedUntil <= now) {
    user.adminLockedUntil = undefined;
    user.adminFailedLogins = 0;
  }
  user.adminFailedLogins = (user.adminFailedLogins || 0) + 1;
  let locked = false;
  if (user.adminFailedLogins >= ADMIN_MAX_FAILED_ATTEMPTS) {
    user.adminLockedUntil = now + ADMIN_LOCK_MS;
    user.adminFailedLogins = 0;
    locked = true;
  }
  db.save();
  return { locked };
}

function registerSuccess(user: StoredUser) {
  if (user.adminFailedLogins || user.adminLockedUntil) {
    user.adminFailedLogins = 0;
    user.adminLockedUntil = undefined;
  }
}

export const AdminAuthService = {
  /**
   * Admin sign-in. Same generic error for "no such admin" / "not an admin" / "wrong password" (no enumeration, and a
   * dummy bcrypt keeps the timing alike). After ADMIN_MAX_FAILED_ATTEMPTS wrong passwords the ACCOUNT is locked for
   * ADMIN_LOCK_MS regardless of the source IP.
   */
  login(emailInput: unknown, password: unknown, now = Date.now()): AdminLoginResult {
    const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
    const pw = typeof password === 'string' ? password.slice(0, 200) : '';
    const user = email ? (db.users.find((u) => u.email.toLowerCase() === email && u.role === 'admin') as StoredUser | undefined) : undefined;

    // One message for every failure (unknown e-mail, not an admin, wrong password, locked): no account enumeration.
    const GENERIC = 'Invalid admin email or password. After 5 failed attempts an account is locked for 15 minutes.';
    const generic: AdminLoginResult = { ok: false, status: 401 as const, error: GENERIC };
    const matches = bcrypt.compareSync(pw, user?.passwordHash || getDummyHash());
    if (!user || !user.passwordHash) return generic;

    const remaining = lockRemainingSec(user, now);
    if (remaining > 0) {
      return { ok: false, status: 401, error: GENERIC, code: 'ADMIN_LOCKED', retryAfterSec: remaining, adminId: user.id };
    }
    if (!matches || !pw) {
      const { locked } = registerFailure(user, now);
      return locked
        ? { ok: false, status: 401, error: GENERIC, code: 'ADMIN_LOCKED', retryAfterSec: ADMIN_LOCK_MS / 1000, adminId: user.id }
        : { ...generic, adminId: user.id };
    }
    if (user.status === 'suspended') {
      return { ok: false, status: 401, error: 'This admin account has been suspended.', code: 'ACCOUNT_SUSPENDED', adminId: user.id };
    }

    registerSuccess(user);
    user.lastLoginAt = new Date(now).toISOString();
    db.save();
    return {
      ok: true,
      token: AuthService.generateToken(user),
      user: AuthService.toPublicUser(user, { mustChangePassword: Boolean(user.mustChangePassword) }),
      mustChangePassword: Boolean(user.mustChangePassword),
    };
  },

  /** Re-authentication for destructive actions. Shares the lockout counter with sign-in. */
  confirmPassword(adminId: string, password: unknown, now = Date.now()): AdminConfirmResult {
    const user = db.users.find((u) => u.id === adminId) as StoredUser | undefined;
    if (!user || user.role !== 'admin') return { ok: false, reason: 'INVALID' };
    if (!user.passwordHash) return { ok: false, reason: 'NO_PASSWORD' };
    const remaining = lockRemainingSec(user, now);
    if (remaining > 0) return { ok: false, reason: 'LOCKED', retryAfterSec: remaining };
    const supplied = typeof password === 'string' ? password.slice(0, 200) : '';
    if (supplied && bcrypt.compareSync(supplied, user.passwordHash)) {
      registerSuccess(user);
      return { ok: true };
    }
    const { locked } = registerFailure(user, now);
    return locked ? { ok: false, reason: 'LOCKED', retryAfterSec: ADMIN_LOCK_MS / 1000 } : { ok: false, reason: 'INVALID' };
  },

  /** Ends every session of a user (all their JWTs stop verifying) — used for "sign out everywhere" and suspensions. */
  revokeAllSessions(userId: string): boolean {
    const user = db.users.find((u) => u.id === userId) as StoredUser | undefined;
    if (!user) return false;
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    db.save();
    return true;
  },

  countActiveAdmins(): number {
    return db.users.filter((u) => u.role === 'admin' && u.status !== 'suspended').length;
  },
};

export interface BootstrapInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  /** allow converting an existing customer/technician account into an admin */
  promote?: boolean;
  /** replace the password of an EXISTING admin */
  resetPassword?: boolean;
  /** force the admin to choose their own password at first sign-in (true whenever the password came from env / a script) */
  mustChangePassword?: boolean;
}

export interface BootstrapResult {
  ok: boolean;
  status?: 'created' | 'promoted' | 'password_reset' | 'exists';
  userId?: string;
  email?: string;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates (or promotes / resets) an admin account. There is NO default admin and NO seeded password anywhere: the
 * password must be supplied by the operator, must satisfy the strict admin policy, and is stored bcrypt-hashed only.
 * Idempotent: an existing admin is left untouched unless `resetPassword` is set.
 */
export function createOrPromoteAdmin(input: BootstrapInput): BootstrapResult {
  const email = String(input.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) return { ok: false, error: 'A valid admin e-mail address is required.' };
  const existing = db.users.find((u) => u.email.toLowerCase() === email) as StoredUser | undefined;

  if (existing?.role === 'admin' && !input.resetPassword) {
    return { ok: true, status: 'exists', userId: existing.id, email };
  }

  const name = String(input.name || existing?.name || email.split('@')[0]).trim().slice(0, 100) || 'Fixhub Admin';
  const policyMsg = validateAdminPassword(input.password, { email, name });
  if (policyMsg) return { ok: false, error: policyMsg };

  if (existing && existing.role !== 'admin' && !input.promote) {
    return { ok: false, error: `An account with ${email} already exists (role: ${existing.role}). Pass promote=true (--promote) to turn it into an admin.` };
  }

  const passwordHash = bcrypt.hashSync(input.password, BCRYPT_COST);
  const mustChange = input.mustChangePassword ?? true;

  if (existing) {
    const wasAdmin = existing.role === 'admin';
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    existing.sessionVersion = (existing.sessionVersion || 1) + 1; // every earlier session is invalid
    existing.mustChangePassword = mustChange;
    existing.status = 'active';
    existing.suspendedAt = undefined;
    existing.suspendedReason = undefined;
    existing.adminFailedLogins = 0;
    existing.adminLockedUntil = undefined;
    existing.emailVerified = true;
    if (name) existing.name = name;
    db.save();
    return { ok: true, status: wasAdmin ? 'password_reset' : 'promoted', userId: existing.id, email };
  }

  const phone = input.phone ? normalizeNgPhone(input.phone) || String(input.phone).trim().slice(0, 30) : '';
  const user: StoredUser = {
    id: `usr_admin_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    email,
    phone,
    name,
    role: 'admin',
    createdAt: new Date().toISOString(),
    passwordHash,
    emailVerified: true,
    phoneVerified: false,
    authProvider: 'local',
    mustChangePassword: mustChange,
    status: 'active',
  };
  db.users.push(user);
  db.save();
  return { ok: true, status: 'created', userId: user.id, email };
}

/**
 * Optional boot-time bootstrap for platforms without shell access (Cloud Run, PaaS): when ADMIN_BOOTSTRAP_EMAIL and
 * ADMIN_BOOTSTRAP_PASSWORD are set and that admin does not exist yet, it is created with mustChangePassword=true.
 * An existing admin is NEVER modified by the env (so a leftover variable cannot reset a password). Remove both variables
 * after the first sign-in.
 */
export function bootstrapAdminFromEnv(env: NodeJS.ProcessEnv = process.env): BootstrapResult | null {
  const email = env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email && !password) return null;
  if (!email || !password) {
    return { ok: false, error: 'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must both be set.' };
  }
  return createOrPromoteAdmin({
    email,
    password,
    name: env.ADMIN_BOOTSTRAP_NAME,
    promote: /^(1|true)$/i.test(env.ADMIN_BOOTSTRAP_PROMOTE || ''),
    mustChangePassword: true,
  });
}

export { ADMIN_PASSWORD_MIN_LENGTH };

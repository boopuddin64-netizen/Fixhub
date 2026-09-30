/**
 * Password policy for ADMIN accounts (stricter than the customer/technician rule of "8 chars + a digit").
 * Single source of truth: the server (server/services/authService.ts, admin bootstrap + change-password) and the
 * admin portal UI (live strength hints) both import this file. The server stays the authority.
 */
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export const ADMIN_PASSWORD_POLICY_MESSAGE =
  `Admin passwords must be ${ADMIN_PASSWORD_MIN_LENGTH}-${ADMIN_PASSWORD_MAX_LENGTH} characters and include an upper-case letter, ` +
  'a lower-case letter, a number and a symbol, and must not contain your e-mail name, "fixhub" or "password".';

export interface AdminPasswordContext {
  email?: string;
  name?: string;
}

const COMMON_FRAGMENTS = ['password', 'fixhub', 'qwerty', 'letmein', 'admin123', '123456', 'abcdef'];

/** Returns a human readable reason the password is unacceptable, or null when it is fine. */
export function validateAdminPassword(password: unknown, ctx: AdminPasswordContext = {}): string | null {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) return `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters long.`;
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) return `Password must be at most ${ADMIN_PASSWORD_MAX_LENGTH} characters long.`;
  if (!/[a-z]/.test(password)) return 'Password must contain a lower-case letter.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an upper-case letter.';
  if (!/\d/.test(password)) return 'Password must contain a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol (for example ! ? # % *).';
  if (/(.)\1{3,}/.test(password)) return 'Password must not repeat the same character 4 or more times in a row.';
  const lower = password.toLowerCase();
  for (const frag of COMMON_FRAGMENTS) {
    if (lower.includes(frag)) return `Password must not contain "${frag}".`;
  }
  const emailName = (ctx.email || '').split('@')[0].toLowerCase();
  if (emailName.length >= 4 && lower.includes(emailName)) return 'Password must not contain the name part of your e-mail address.';
  const nameParts = (ctx.name || '').toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  for (const part of nameParts) {
    if (lower.includes(part)) return 'Password must not contain your name.';
  }
  return null;
}

export function isAdminPasswordAcceptable(password: unknown, ctx: AdminPasswordContext = {}): password is string {
  return validateAdminPassword(password, ctx) === null;
}

/** 0 (very weak) .. 4 (strong): UI hint only, never a security decision. */
export function adminPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= ADMIN_PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

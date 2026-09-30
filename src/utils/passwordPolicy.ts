/**
 * Client-side mirror of the server password policy (server/services/authService.ts: isPasswordAcceptable):
 * at least 8 characters and at least one digit. The server stays the authority; this only gives instant feedback.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Returns an error message, or null when the password is acceptable. */
export function validateNewPassword(password: string, confirmation?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/\d/.test(password)) return 'New password must contain at least one number.';
  if (confirmation !== undefined && password !== confirmation) return 'New passwords do not match.';
  return null;
}

/** True for the API answer "this account has no password yet" (403 PASSWORD_NOT_SET). */
export function isPasswordNotSetError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'PASSWORD_NOT_SET';
}

/**
 * Which step a re-authentication dialog (delete account, switch role) should show:
 *  - 'set-password'  the account is known to have no password (user.hasPassword === false) -> ask to set one first
 *  - 'confirm'       ask for the current password
 * `hasPassword` undefined (older payloads) is treated as "has a password"; the 403 PASSWORD_NOT_SET fallback covers it.
 */
export function reauthStep(hasPassword: boolean | undefined, passwordNotSetSeen: boolean): 'set-password' | 'confirm' {
  return hasPassword === false || passwordNotSetSeen ? 'set-password' : 'confirm';
}

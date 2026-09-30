/**
 * Locale-independent formatting helpers shared by the web app and the server (notifications, CSV exports).
 * Deliberately NOT built on Number#toLocaleString(): its output depends on the browser / Node locale (e.g. "1.234"
 * or "1 234"), which made prices look different from device to device.
 */

/** "1234567" -> "1,234,567" (integer part only). */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Formats an amount in Naira: 1234567 -> "₦1,234,567", 1234.5 -> "₦1,234.50", NaN/undefined -> "₦0". */
export function formatNaira(amount: unknown, opts: { decimals?: 0 | 2 | 'auto' } = {}): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const decimals = opts.decimals ?? 'auto';
  const digits = decimals === 'auto' ? (Number.isInteger(value) ? 0 : 2) : decimals;
  const fixed = Math.abs(value).toFixed(digits);
  const [intPart, frac] = fixed.split('.');
  const body = `${groupThousands(intPart)}${frac ? `.${frac}` : ''}`;
  const isZero = Number(fixed) === 0;
  return `${value < 0 && !isZero ? '-' : ''}₦${body}`;
}

/** Plain grouped number ("1,234"): counts, quantities. */
export function formatCount(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? groupThousands(String(Math.trunc(Math.abs(v)))).replace(/^/, v < 0 ? '-' : '') : '0';
}

/**
 * Normalises a Nigerian mobile number to E.164 ("+2348031234567"). Accepts "0803 123 4567", "+234 803 123 4567",
 * "2348031234567", "803 123 4567" and the common "+2340803..." typo. Returns null when it is not a valid mobile number
 * (10 digits after the country code, starting 7, 8 or 9).
 */
export function normalizeNgPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('234')) {
    digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return /^[789]\d{9}$/.test(digits) ? `+234${digits}` : null;
}

export const PHONE_FORMAT_HINT = 'Use 11 digits like 0803 123 4567, or +234 803 123 4567.';

/** Inline form message for a phone field: null when fine, otherwise what to fix. */
export function phoneFieldError(input: string): string | null {
  if (!input.trim()) return 'Enter your phone number.';
  return isValidNgPhone(input) ? null : `That does not look like a Nigerian mobile number. ${PHONE_FORMAT_HINT}`;
}

export function isValidNgPhone(input: unknown): boolean {
  return normalizeNgPhone(input) !== null;
}

/** "+2348031234567" -> "+234 803 123 4567"; unrecognised input is returned unchanged. */
export function formatNgPhone(input: unknown): string {
  const e164 = normalizeNgPhone(input);
  if (!e164) return typeof input === 'string' ? input : '';
  const d = e164.slice(4);
  return `+234 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Same phone number regardless of formatting ("0803 123 4567" == "+2348031234567"). Empty values never match. */
export function phonesMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const na = normalizeNgPhone(a);
  const nb = normalizeNgPhone(b);
  if (na && nb) return na === nb;
  const sa = a.replace(/\s+/g, '');
  const sb = b.replace(/\s+/g, '');
  return sa.length > 0 && sa === sb;
}

/** "5 min ago", "3 h ago", "Yesterday", "12 Mar". `now` is injectable for tests. */
export function timeAgo(iso: string | number | Date, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return formatDate(t);
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is UTC+1 all year (no DST)

/** Calendar day key in Nigerian time ("2026-09-30"), independent of the device / server time zone. */
export function lagosDayKey(iso: string | number | Date): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "30 Sep 2026" in Nigerian time. */
export function formatDate(iso: string | number | Date): string {
  const key = lagosDayKey(iso);
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "30 Sep 2026, 14:05" in Nigerian time (WAT). */
export function formatDateTime(iso: string | number | Date): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const shifted = new Date(t + LAGOS_OFFSET_MS).toISOString();
  return `${formatDate(t)}, ${shifted.slice(11, 16)}`;
}

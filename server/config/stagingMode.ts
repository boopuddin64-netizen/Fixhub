/**
 * Explicit, opt-in STAGING switches (a real deployment, real Postgres, but no paid services yet).
 *
 * Nothing here is active by default and nothing weakens a normal production deploy:
 *
 *  - ALLOW_PAYSTACK_TEST_KEY=true  lets NODE_ENV=production boot with a genuine Paystack TEST secret key (sk_test_...).
 *    Mock/placeholder keys (contains "mock", sk_test_xxx) are still rejected, and the app still talks to the real
 *    Paystack API (test mode), so no payment is ever simulated. No effect when a live key (sk_live_...) is used.
 *
 *  - SMS_DEV_MODE=true             replaces SMS delivery with a server-log line (so OTP / reset / verification codes can
 *    be read from the host's log viewer while testing without an SMS provider).
 *      * REFUSED (boot fails, and sendSms fails closed) when the Paystack key is a live key (sk_live_...).
 *      * In NODE_ENV=production it is ALSO refused unless ALLOW_SMS_LOG_OTP=true is set explicitly.
 *
 * Remove all three variables at launch (the production validator then demands a live Paystack key and a real SMS key again).
 */

const truthy = (v: string | undefined) => /^(1|true)$/i.test((v || '').trim());

export function isLivePaystackKey(key: string | undefined): boolean {
  return (key || '').trim().startsWith('sk_live_');
}

/** A real-looking Paystack TEST key (never the built-in mock/placeholder ones). */
export function isRealPaystackTestKey(key: string | undefined): boolean {
  const k = (key || '').trim();
  return k.startsWith('sk_test_') && !k.toLowerCase().includes('mock') && !k.startsWith('sk_test_xxx') && k.length >= 16;
}

/** True when production may run with a Paystack TEST key (explicit opt-in + a genuine test key). */
export function paystackTestKeyAllowedInProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return truthy(env.ALLOW_PAYSTACK_TEST_KEY) && isRealPaystackTestKey(env.PAYSTACK_SECRET_KEY);
}

export interface SmsLogModeState {
  /** SMS_DEV_MODE was requested */
  requested: boolean;
  /** requested AND permitted: SMS are written to the server log instead of being sent */
  active: boolean;
  /** why a requested mode is refused */
  error?: string;
}

export function resolveSmsLogMode(env: NodeJS.ProcessEnv = process.env): SmsLogModeState {
  if (!truthy(env.SMS_DEV_MODE)) return { requested: false, active: false };
  if (isLivePaystackKey(env.PAYSTACK_SECRET_KEY)) {
    return { requested: true, active: false, error: 'SMS_DEV_MODE (OTPs written to the server log) is refused while a live Paystack key (sk_live_...) is configured. Remove SMS_DEV_MODE.' };
  }
  if (env.NODE_ENV === 'production' && !truthy(env.ALLOW_SMS_LOG_OTP)) {
    return { requested: true, active: false, error: 'SMS_DEV_MODE is refused in production unless ALLOW_SMS_LOG_OTP=true is set explicitly (staging only).' };
  }
  return { requested: true, active: true };
}

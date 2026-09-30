/**
 * Production Environment and Secrets Validator.
 * Enforces strict fail-fast validation in production mode so insecure defaults,
 * test keys, or missing credentials halt execution before server boots.
 */
import { paystackTestKeyAllowedInProduction, resolveSmsLogMode } from './stagingMode';

export function validateProductionSecrets(
  env: NodeJS.ProcessEnv = process.env,
  exitOnError: boolean = true
): { valid: boolean; error?: string } {
  if (env.NODE_ENV !== 'production') {
    return { valid: true };
  }

  // 1. Validate PAYSTACK_SECRET_KEY in production
  const paystackKey = env.PAYSTACK_SECRET_KEY?.trim();
  const stagingTestKey = paystackTestKeyAllowedInProduction(env);
  if (
    !paystackKey ||
    paystackKey === '' ||
    paystackKey.toLowerCase().includes('mock') ||
    (paystackKey.startsWith('sk_test') && !stagingTestKey)
  ) {
    const errorMsg = 'FATAL: A valid live PAYSTACK_SECRET_KEY is required when NODE_ENV=production.';
    console.error(errorMsg);
    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  // 2. Validate Database configuration in production (prevent silent in-memory fallback)
  if (!env.DATABASE_URL && !env.PGHOST) {
    const errorMsg = 'FATAL: DATABASE_URL or PGHOST must be set when NODE_ENV=production — refusing to start with in-memory storage.';
    console.error(errorMsg);
    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  // 3. Validate JWT_SECRET in production
  const jwtSecret = env.JWT_SECRET?.trim();
  if (
    !jwtSecret ||
    jwtSecret === '' ||
    jwtSecret === 'fixhub-dev-secret-key-production-change-me' ||
    jwtSecret.toLowerCase().includes('dev-secret') ||
    jwtSecret.length < 32
  ) {
    const errorMsg = 'FATAL: A secure JWT_SECRET (minimum 32 characters) is required in production.';
    console.error(errorMsg);
    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  if (stagingTestKey) {
    console.warn('[staging] Paystack TEST key accepted in production (ALLOW_PAYSTACK_TEST_KEY=true): no real money moves. Remove ALLOW_PAYSTACK_TEST_KEY and use the live key at launch.');
  }

  // 4. Validate SMS_PROVIDER_API_KEY in production (or the explicit staging SMS log mode)
  const smsMode = resolveSmsLogMode(env);
  if (smsMode.requested && !smsMode.active) {
    const errorMsg = `FATAL: ${smsMode.error}`;
    console.error(errorMsg);
    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }
  if (smsMode.active) {
    console.warn('[staging] SMS_DEV_MODE active: verification / reset / bank OTP codes are written to the server log, no SMS is sent. Remove SMS_DEV_MODE + ALLOW_SMS_LOG_OTP at launch.');
  }
  const smsKey = (env.SMS_PROVIDER_API_KEY || env.SENDCHAMP_API_KEY || env.TERMII_API_KEY || env.AFRICASTALKING_API_KEY)?.trim();
  if (!smsKey && !smsMode.active) {
    const errorMsg = 'FATAL: A valid SMS_PROVIDER_API_KEY (or SENDCHAMP_API_KEY / TERMII_API_KEY / AFRICASTALKING_API_KEY) is required when NODE_ENV=production.';
    console.error(errorMsg);
    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  // 5. PAYMENT_MODE must be live in production (sandbox simulates successful payments)
  const paymentMode = env.PAYMENT_MODE?.trim().toLowerCase();
  if (paymentMode && paymentMode !== 'live') {
    const errorMsg = 'FATAL: PAYMENT_MODE must be "live" (or unset) when NODE_ENV=production; sandbox mode simulates payments.';
    console.error(errorMsg);
    if (exitOnError) {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  return { valid: true };
}

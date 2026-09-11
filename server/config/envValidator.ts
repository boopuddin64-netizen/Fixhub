/**
 * Production Environment and Secrets Validator.
 * Enforces strict fail-fast validation in production mode so insecure defaults,
 * test keys, or missing credentials halt execution before server boots.
 */
export function validateProductionSecrets(
  env: NodeJS.ProcessEnv = process.env,
  exitOnError: boolean = true
): { valid: boolean; error?: string } {
  if (env.NODE_ENV !== 'production') {
    return { valid: true };
  }

  // 1. Validate PAYSTACK_SECRET_KEY in production
  const paystackKey = env.PAYSTACK_SECRET_KEY?.trim();
  if (
    !paystackKey ||
    paystackKey === '' ||
    paystackKey.toLowerCase().includes('mock') ||
    paystackKey.startsWith('sk_test')
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

  // 2. Validate JWT_SECRET in production
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

  return { valid: true };
}

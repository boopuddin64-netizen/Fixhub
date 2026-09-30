/**
 * Staging switches (ALLOW_PAYSTACK_TEST_KEY, SMS_DEV_MODE, ALLOW_SMS_LOG_OTP): explicit opt-in only, and never
 * able to weaken a live-key production deploy. See server/config/stagingMode.ts.
 */
import { validateProductionSecrets } from '../../server/config/envValidator';
import { spawnSync } from 'child_process';
import { resolveSmsLogMode, isRealPaystackTestKey, paystackTestKeyAllowedInProduction } from '../../server/config/stagingMode';
import { sendSms } from '../../server/services/smsService';

export async function runStagingModeTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Staging Mode Tests ---');
  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, name: string, detail?: string) => {
    if (cond) { console.log(`  [PASS] ${name}`); passed++; } else { console.error(`  [FAIL] ${name} ${detail ? `-> ${detail}` : ''}`); failed++; }
  };

  const TEST_KEY = 'sk_test_' + 'a'.repeat(30);
  const LIVE_KEY = 'sk_live_' + 'b'.repeat(30);
  const base: any = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x', JWT_SECRET: 'j'.repeat(48) };
  const throws = (fn: () => unknown) => {
    const origErr = console.error;
    console.error = () => {};
    try { fn(); return false; } catch { return true; } finally { console.error = origErr; }
  };
  const quiet = <T>(fn: () => T): T => {
    const w = console.warn;
    console.warn = () => {};
    try { return fn(); } finally { console.warn = w; }
  };
  const validate = (env: any) => validateProductionSecrets(env, false);

  // --- Paystack TEST key in production: only with explicit opt-in and a genuine test key
  assert(throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: TEST_KEY, SMS_PROVIDER_API_KEY: 'k' })), 'production still rejects a Paystack test key by default');
  assert(!throws(() => quiet(() => validate({ ...base, PAYSTACK_SECRET_KEY: TEST_KEY, ALLOW_PAYSTACK_TEST_KEY: 'true', SMS_PROVIDER_API_KEY: 'k' }))), 'ALLOW_PAYSTACK_TEST_KEY=true accepts a real sk_test_ key');
  // Real boots (server.ts has its own copy of the Paystack check): the DB URL points at a closed port so the process dies
  // right after the env validation; we only look at WHICH error it dies with.
  const runBoot = (env: Record<string, string>) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', NODE_ENV: 'production', PORT: '0', DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x', JWT_SECRET: 'j'.repeat(48), ...env },
      timeout: 45000,
      encoding: 'utf-8',
    });
  const noOptIn = runBoot({ PAYSTACK_SECRET_KEY: TEST_KEY, SMS_PROVIDER_API_KEY: 'k' });
  assert(noOptIn.status === 1 && /PAYSTACK_SECRET_KEY is required/.test(noOptIn.stderr + noOptIn.stdout), 'real boot: test key without opt-in exits 1 naming PAYSTACK_SECRET_KEY');
  const withOptIn = runBoot({ PAYSTACK_SECRET_KEY: TEST_KEY, ALLOW_PAYSTACK_TEST_KEY: 'true', SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true' });
  assert(!/FATAL/.test(withOptIn.stderr + withOptIn.stdout) && /\[staging\]/.test(withOptIn.stderr + withOptIn.stdout), 'real boot: test key + staging flags pass env validation (dies later on the unreachable DB only)');
  const liveWithLog = runBoot({ PAYSTACK_SECRET_KEY: LIVE_KEY, SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true' });
  assert(liveWithLog.status === 1 && /SMS_DEV_MODE/.test(liveWithLog.stderr + liveWithLog.stdout), 'real boot: live key + SMS_DEV_MODE exits 1');
  for (const bad of ['sk_test_mock_fixhub_development_key', 'sk_test_xxx', 'sk_test_short', 'mock', '']) {
    assert(throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: bad, ALLOW_PAYSTACK_TEST_KEY: 'true', SMS_PROVIDER_API_KEY: 'k' })), `opt-in never accepts placeholder/mock key "${bad || '(empty)'}"`);
  }
  assert(!isRealPaystackTestKey(LIVE_KEY) && isRealPaystackTestKey(TEST_KEY), 'isRealPaystackTestKey distinguishes test/live/mock');
  assert(paystackTestKeyAllowedInProduction({ PAYSTACK_SECRET_KEY: TEST_KEY } as any) === false, 'a test key without the flag is not allowed');
  assert(!throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: LIVE_KEY, SMS_PROVIDER_API_KEY: 'k' })), 'a live key keeps working exactly as before');
  assert(throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: TEST_KEY, ALLOW_PAYSTACK_TEST_KEY: 'true', PAYMENT_MODE: 'sandbox', SMS_PROVIDER_API_KEY: 'k' })), 'PAYMENT_MODE=sandbox is still rejected in production');

  // --- SMS log mode
  assert(resolveSmsLogMode({ NODE_ENV: 'production', PAYSTACK_SECRET_KEY: TEST_KEY } as any).requested === false, 'SMS log mode is off by default');
  const prodNoAllow = resolveSmsLogMode({ NODE_ENV: 'production', SMS_DEV_MODE: 'true', PAYSTACK_SECRET_KEY: TEST_KEY } as any);
  assert(prodNoAllow.requested && !prodNoAllow.active, 'SMS_DEV_MODE in production is refused without ALLOW_SMS_LOG_OTP=true');
  const prodAllow = resolveSmsLogMode({ NODE_ENV: 'production', SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true', PAYSTACK_SECRET_KEY: TEST_KEY } as any);
  assert(prodAllow.active, 'SMS_DEV_MODE + ALLOW_SMS_LOG_OTP=true is active with a test key');
  const liveRefused = resolveSmsLogMode({ NODE_ENV: 'production', SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true', PAYSTACK_SECRET_KEY: LIVE_KEY } as any);
  assert(liveRefused.requested && !liveRefused.active, 'SMS log mode is refused with a live Paystack key even with ALLOW_SMS_LOG_OTP');
  assert(resolveSmsLogMode({ NODE_ENV: 'development', SMS_DEV_MODE: 'true', PAYSTACK_SECRET_KEY: LIVE_KEY } as any).active === false, 'SMS log mode refused with a live key outside production too');

  assert(!throws(() => quiet(() => validate({ ...base, PAYSTACK_SECRET_KEY: TEST_KEY, ALLOW_PAYSTACK_TEST_KEY: 'true', SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true' }))), 'production boots with test key + SMS log mode and no SMS provider key (staging)');
  assert(throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: TEST_KEY, ALLOW_PAYSTACK_TEST_KEY: 'true' })), 'without SMS log mode an SMS key is still required');
  assert(throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: TEST_KEY, ALLOW_PAYSTACK_TEST_KEY: 'true', SMS_DEV_MODE: 'true' })), 'boot fails when SMS_DEV_MODE is set in production without ALLOW_SMS_LOG_OTP');
  assert(throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: LIVE_KEY, SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true' })), 'boot fails when SMS_DEV_MODE is set together with a live key');
  assert(!throws(() => validate({ ...base, PAYSTACK_SECRET_KEY: LIVE_KEY, SENDCHAMP_API_KEY: 'k' })), 'SENDCHAMP_API_KEY alone now satisfies the boot validator');

  // --- sendSms behaviour
  const saved = { ...process.env };
  const savedLog = console.log;
  const savedErr = console.error;
  const savedFetch = (globalThis as any).fetch;
  const logged: string[] = [];
  let fetchCalls = 0;
  try {
    console.log = (...a: unknown[]) => { logged.push(a.join(' ')); };
    console.error = () => {};
    (globalThis as any).fetch = async () => { fetchCalls++; return { ok: true, json: async () => ({ status: 'success' }) }; };
    Object.assign(process.env, { NODE_ENV: 'production', PAYSTACK_SECRET_KEY: TEST_KEY, SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true' });
    delete process.env.SENDCHAMP_API_KEY; delete process.env.SMS_PROVIDER_API_KEY;
    const ok = await sendSms('08012345678', 'Your Fixhub code is 123456');
    assert(ok.success === true && fetchCalls === 0 && logged.some((l) => l.includes('[STAGING SMS]') && l.includes('123456')), 'staging: sendSms logs the OTP and never calls a provider');

    delete process.env.ALLOW_SMS_LOG_OTP;
    logged.length = 0;
    const refused = await sendSms('08012345678', 'Your Fixhub code is 654321');
    assert(refused.success === false && fetchCalls === 0 && !logged.some((l) => l.includes('654321')), 'production without ALLOW_SMS_LOG_OTP: fails closed, nothing logged, nothing sent');

    process.env.ALLOW_SMS_LOG_OTP = 'true';
    process.env.PAYSTACK_SECRET_KEY = LIVE_KEY;
    logged.length = 0;
    const liveRes = await sendSms('08012345678', 'Your Fixhub code is 111222');
    assert(liveRes.success === false && !logged.some((l) => l.includes('111222')), 'live key: OTP is never logged even if the flags are still set');

    delete process.env.SMS_DEV_MODE;
    process.env.SMS_PROVIDER_API_KEY = 'k';
    const real = await sendSms('08012345678', 'hello');
    assert(real.success === true && fetchCalls === 1, 'without SMS_DEV_MODE production still sends through the provider');
  } finally {
    console.log = savedLog;
    console.error = savedErr;
    (globalThis as any).fetch = savedFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }

  console.log(`\nStaging mode tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * EARLY_LISTEN hand-over (needs a REAL PostgreSQL: FIXHUB_USE_POSTGRES=true + DATABASE_URL, as in the CI postgres job).
 * Instance A holds the writer lock; instance B (started while A is alive, like a Render deploy) must open its port at once
 * (/health = "starting", everything else 503) and become fully ready once A shuts down on SIGTERM.
 * Runs in a throw-away database so it never touches the data of the surrounding test run.
 */
export async function runEarlyListenHandoverTest(): Promise<{ passed: number; failed: number }> {
  const { pgDb } = await import('../../server/db/pgClient');
  await pgDb.ready;
  if (pgDb.isMemoryMode || !process.env.DATABASE_URL) {
    console.log('  [SKIP] EARLY_LISTEN hand-over test needs a real PostgreSQL (FIXHUB_USE_POSTGRES=true + DATABASE_URL)');
    return { passed: 0, failed: 0 };
  }
  console.log('\n--- Running EARLY_LISTEN Hand-over Test (real PostgreSQL) ---');
  const { spawn } = await import('child_process');
  const { Client } = await import('pg');
  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, name: string, detail?: string) => {
    if (cond) { console.log(`  [PASS] ${name}`); passed++; } else { console.error(`  [FAIL] ${name} ${detail ? `-> ${detail}` : ''}`); failed++; }
  };

  const dbName = `fixhub_early_${Date.now()}`;
  const adminUrl = new URL(process.env.DATABASE_URL);
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const scratchUrl = new URL(adminUrl.toString());
  scratchUrl.pathname = `/${dbName}`;

  const procs: import('child_process').ChildProcess[] = [];
  const start = (port: number, extra: Record<string, string>) => {
    const p = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH || '', HOME: process.env.HOME || '', NODE_ENV: 'production', PORT: String(port),
        DATABASE_URL: scratchUrl.toString(), JWT_SECRET: 'j'.repeat(48),
        PAYSTACK_SECRET_KEY: 'sk_test_' + 'z'.repeat(30), ALLOW_PAYSTACK_TEST_KEY: 'true', SMS_DEV_MODE: 'true', ALLOW_SMS_LOG_OTP: 'true',
        EARLY_LISTEN: 'true', ...extra,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout?.on('data', (d) => (out += d));
    p.stderr?.on('data', (d) => (out += d));
    procs.push(p);
    return { p, log: () => out };
  };
  const get = async (port: number, path: string) => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(3000) });
      return { status: r.status, body: await r.text() };
    } catch { return { status: 0, body: '' }; }
  };
  const until = async (fn: () => Promise<boolean>, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 400)); }
    return false;
  };

  try {
    const PA = 39411 + Math.floor(Math.random() * 500);
    const PB = PA + 1;
    const a = start(PA, {});
    const aReady = await until(async () => (await get(PA, '/health')).body.includes('"database":"connected"'), 60000);
    assert(aReady, 'instance A boots and becomes ready');

    const b = start(PB, { WRITER_LOCK_WAIT_MS: '60000', RENDER_EXTERNAL_URL: 'https://fixhub-example.onrender.com/' });
    const bStarting = await until(async () => (await get(PB, '/health')).body.includes('"starting"'), 30000);
    assert(bStarting, 'instance B opens its port immediately and answers /health with "starting" while A holds the lock');
    const other = await get(PB, '/api/health');
    assert(other.status === 503, 'instance B answers other routes with 503 until it owns the writer lock', `status=${other.status}`);
    assert(b.p.exitCode === null, 'instance B keeps waiting (does not exit) for the lock');

    a.p.kill('SIGTERM');
    const aGone = await until(async () => a.p.exitCode !== null, 20000);
    assert(aGone && a.p.exitCode === 0, 'instance A shuts down cleanly on SIGTERM (exit 0)', `exit=${a.p.exitCode}`);
    assert(/SIGTERM received, flushing state/.test(a.log()), 'instance A logged the graceful flush');

    const bReady = await until(async () => (await get(PB, '/health')).body.includes('"database":"connected"'), 40000);
    assert(bReady, 'instance B takes over the writer lock and becomes ready after A exits');
    assert((await get(PB, '/api/health')).status === 200, 'instance B serves the API after hand-over');
    const cors = await fetch(`http://127.0.0.1:${PB}/api/health`, { headers: { Origin: 'https://fixhub-example.onrender.com' } });
    assert(cors.headers.get('access-control-allow-origin') === 'https://fixhub-example.onrender.com', 'APP_URL defaults to RENDER_EXTERNAL_URL (CORS allows the Render origin)');
    const evil = await fetch(`http://127.0.0.1:${PB}/api/health`, { headers: { Origin: 'https://evil.example.com' } });
    assert(!evil.headers.get('access-control-allow-origin'), 'other origins still get no CORS headers');
    b.p.kill('SIGTERM');
    await until(async () => b.p.exitCode !== null, 20000);
  } finally {
    for (const p of procs) if (p.exitCode === null) p.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 500));
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  }
  console.log(`\nEARLY_LISTEN hand-over test: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Regression tests for the security audit fixes (branch fix/security-audit-fixes).
 * Route-level tests mount the real apiRouter on an ephemeral Express app (port 0).
 */
import express from 'express';
import type { AddressInfo } from 'net';
import { db } from '../../server/db';
import { apiRouter } from '../../server/routes/api';
import { AuthService } from '../../server/services/authService';

let ipCounter = 1;

async function startApp(): Promise<{ base: string; close: () => Promise<void> }> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', apiRouter);
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}/api`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export async function runSecurityAuditFixTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Security Audit Fix Regression Tests ---');
  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, name: string, detail?: string) => {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  };

  db.resetToSeed();
  const app = await startApp();
  // Every request gets a distinct X-Forwarded-For so the IP rate limiters never interfere.
  const call = async (method: string, path: string, body?: any, token?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(`${app.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  try {
    // ---- Fix 1: login requires a password ----
    console.log('Fix 1: login requires a valid password');
    const noPw = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local' });
    assert(noPw.status === 400 && !noPw.json?.token, 'Login with no password is rejected (400, no token)', JSON.stringify(noPw.json));
    const emptyPw = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: '' });
    assert(emptyPw.status === 400 && !emptyPw.json?.token, 'Login with empty password is rejected');
    const objPw = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: { $ne: 1 } });
    assert(objPw.status === 400 && !objPw.json?.token, 'Login with non-string password is rejected');
    const badPw = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'wrong-password' });
    assert(badPw.status === 400 && !badPw.json?.token, 'Login with wrong password is rejected');
    const okPw = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' });
    assert(okPw.status === 200 && !!okPw.json?.token, 'Login with correct password still works');
    const svc = AuthService.login('customer@test.fixhub.local');
    assert('error' in svc, 'AuthService.login without password returns an error');
    const svcEmpty = AuthService.login('customer@test.fixhub.local', '');
    assert('error' in svcEmpty, 'AuthService.login with empty password returns an error');
    // A user with no password hash (e.g. social-only) can never log in by password
    (db.users as any[]).push({ id: 'usr_social_nohash', email: 'social-nohash@example.com', phone: '+2348000000099', name: 'Social', role: 'customer', passwordHash: '', createdAt: new Date().toISOString() });
    const socialPw = await call('POST', '/auth/login', { emailOrPhone: 'social-nohash@example.com', password: 'anything1' });
    assert(socialPw.status === 400 && !socialPw.json?.token, 'Account without a password hash cannot log in via password route');
    const socialNoPw = await call('POST', '/auth/login', { emailOrPhone: 'social-nohash@example.com' });
    assert(socialNoPw.status === 400 && !socialNoPw.json?.token, 'Account without a password hash cannot log in with no password');
    (db.users as any[]).splice((db.users as any[]).findIndex((u) => u.id === 'usr_social_nohash'), 1);
    // Social login lives on its own route and is unaffected (it rejects a bad provider token without needing a password)
    const soc = await call('POST', '/auth/social-login', { provider: 'google', token: 'invalid-token' });
    assert(soc.status !== 200 && !soc.json?.token && soc.status !== 404, 'Social login route is separate and still verifies provider tokens');

    // <<FIXES>>
  } catch (err: any) {
    assert(false, 'Security audit regression suite threw', err?.stack || err?.message);
  } finally {
    await app.close();
  }

  console.log(`--- Finished Security Audit Fix Tests: ${passed} passed, ${failed} failed ---\n`);
  return { passed, failed };
}

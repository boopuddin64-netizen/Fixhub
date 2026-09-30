/**
 * Tests for the set-password flow of social-login-only (Google) accounts (branch feat/set-password-and-polish):
 * POST /auth/set-password, hasPassword in the public user, PASSWORD_NOT_SET -> set -> retry for delete-account /
 * switch-role, plus the client-side logic (ApiClient error codes / token handling, password policy helpers).
 * Route-level tests mount the real apiRouter on an ephemeral Express app (port 0).
 */
import express from 'express';
import type { AddressInfo } from 'net';
import bcrypt from 'bcryptjs';
import { db } from '../../server/db';
import { apiRouter } from '../../server/routes/api';
import { globalErrorHandler } from '../../server/middleware/errorHandler';
import { AuthService, isPasswordAcceptable } from '../../server/services/authService';
import { ApiClient, ApiError } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { validateNewPassword, isPasswordNotSetError, reauthStep, PASSWORD_MIN_LENGTH } from '../utils/passwordPolicy';

let ipCounter = 1;

async function startApp(): Promise<{ base: string; close: () => Promise<void> }> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', apiRouter);
  app.use(globalErrorHandler);
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}/api`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export async function runSetPasswordTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Set-Password (social-login accounts) Tests ---');
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

  const app = await startApp();
  const call = async (method: string, path: string, body?: any, token?: string) => {
    const res = await fetch(`${app.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.88.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  };
  const addSocialUser = (id: string, email: string, role: 'customer' | 'technician' = 'customer') => {
    (db.users as any[]).push({
      id, email, phone: '', name: 'Social User', role, passwordHash: '', authProvider: 'google',
      createdAt: new Date().toISOString(), emailVerified: true, phoneVerified: false,
    });
    return AuthService.generateToken(db.users.find((u) => u.id === id)!);
  };

  const realFetch = globalThis.fetch;
  try {
    // ---------------------------------------------------------------- shared policy
    console.log('1. Password policy helper (server + client mirror)');
    assert(isPasswordAcceptable('abcdefg1') && !isPasswordAcceptable('abcdefgh') && !isPasswordAcceptable('abc1') && !isPasswordAcceptable(undefined) && !isPasswordAcceptable({ $ne: 1 }), 'server policy: >= 8 chars and a digit, strings only');
    assert(PASSWORD_MIN_LENGTH === 8, 'client min length matches the server');
    for (const pw of ['abcdefg1', 'abcdefgh', 'abc1', '12345678', '', 'passwordwithoutdigit', 'a1b2c3d4']) {
      assert((validateNewPassword(pw) === null) === isPasswordAcceptable(pw), `client and server agree on "${pw}"`);
    }
    assert(validateNewPassword('abcdefg1', 'abcdefg2') === 'New passwords do not match.', 'client flags a mismatching confirmation');
    assert(validateNewPassword('abcdefg1', 'abcdefg1') === null, 'matching confirmation passes');

    // ---------------------------------------------------------------- endpoint
    console.log('2. POST /auth/set-password');
    const tok = addSocialUser('usr_sp_1', 'sp1@example.com');
    const noAuth = await call('POST', '/auth/set-password', { newPassword: 'Newpass123' });
    assert(noAuth.status === 401, 'requires authentication');

    const me0 = await call('GET', '/auth/me', undefined, tok);
    assert(me0.status === 200 && me0.json?.user?.hasPassword === false && me0.json?.user?.authProvider === 'google', '/auth/me reports hasPassword=false for a social-only account');
    assert(!me0.text.includes('passwordHash') && !me0.text.includes('"password_hash"'), '/auth/me never exposes the password hash');

    const missing = await call('POST', '/auth/set-password', {}, tok);
    assert(missing.status === 400, 'missing password -> 400');
    const objPw = await call('POST', '/auth/set-password', { newPassword: { $ne: 1 } }, tok);
    assert(objPw.status === 400 && !(db.users.find((u) => u.id === 'usr_sp_1') as any).passwordHash, 'non-string password -> 400, nothing stored');
    const short = await call('POST', '/auth/set-password', { newPassword: 'ab1' }, tok);
    assert(short.status === 400 && short.json?.code === 'WEAK_PASSWORD', 'too short -> 400 WEAK_PASSWORD');
    const noDigit = await call('POST', '/auth/set-password', { newPassword: 'abcdefghij' }, tok);
    assert(noDigit.status === 400 && noDigit.json?.code === 'WEAK_PASSWORD', 'no digit -> 400 WEAK_PASSWORD');
    assert(!(db.users.find((u) => u.id === 'usr_sp_1') as any).passwordHash, 'rejected attempts store no password');

    const auditBefore = db.auditLogs.length;
    const ok = await call('POST', '/auth/set-password', { newPassword: 'Newpass123' }, tok);
    assert(ok.status === 200 && ok.json?.success === true && typeof ok.json?.token === 'string', 'valid password -> 200 with a fresh token');
    assert(ok.json?.user?.hasPassword === true, 'response user has hasPassword=true');
    const stored = (db.users.find((u) => u.id === 'usr_sp_1') as any).passwordHash as string;
    assert(/^\$2[aby]\$12\$/.test(stored) && bcrypt.compareSync('Newpass123', stored), 'stored as bcrypt with cost 12');
    const audit = db.auditLogs.slice(auditBefore).find((a) => a.action === 'PASSWORD_SET');
    assert(!!audit && audit.actorId === 'usr_sp_1' && audit.resourceId === 'usr_sp_1', 'audit log entry PASSWORD_SET written');
    assert(!JSON.stringify(db.auditLogs.slice(auditBefore)).includes('Newpass123'), 'the password never appears in the audit log');
    const oldTok = await call('GET', '/auth/me', undefined, tok);
    assert(oldTok.status === 401, 'the previous token is invalidated (session version bumped)');
    const newTok = ok.json.token as string;
    const me1 = await call('GET', '/auth/me', undefined, newTok);
    assert(me1.status === 200 && me1.json?.user?.hasPassword === true, 'the fresh token works and now reports hasPassword=true');
    const loginOk = await call('POST', '/auth/login', { emailOrPhone: 'sp1@example.com', password: 'Newpass123' });
    assert(loginOk.status === 200 && !!loginOk.json?.token, 'email + the new password can now log in');

    const again = await call('POST', '/auth/set-password', { newPassword: 'Another123' }, newTok);
    assert(again.status === 409 && again.json?.code === 'PASSWORD_ALREADY_SET', 'refused with 409 when the account already has a password');
    assert(bcrypt.compareSync('Newpass123', (db.users.find((u) => u.id === 'usr_sp_1') as any).passwordHash), 'existing password untouched by the refused call');

    const seeded = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' });
    const seededSet = await call('POST', '/auth/set-password', { newPassword: 'Hijack12345' }, seeded.json?.token);
    assert(seededSet.status === 409, 'a password-account cannot use set-password to overwrite its password without the current one');

    // ---------------------------------------------------------------- PASSWORD_NOT_SET -> set -> retry
    console.log('3. delete-account / switch-role: PASSWORD_NOT_SET, set a password, retry');
    let t = addSocialUser('usr_sp_2', 'sp2@example.com');
    const sw1 = await call('POST', '/auth/switch-role', { role: 'technician', password: 'x' }, t);
    assert(sw1.status === 403 && sw1.json?.code === 'PASSWORD_NOT_SET', 'switch-role -> 403 PASSWORD_NOT_SET');
    const del1 = await call('DELETE', '/account/me', { password: 'x' }, t);
    assert(del1.status === 403 && del1.json?.code === 'PASSWORD_NOT_SET' && db.users.some((u) => u.id === 'usr_sp_2'), 'delete-account -> 403 PASSWORD_NOT_SET, user kept');
    const setRes = await call('POST', '/auth/set-password', { newPassword: 'Secure1234' }, t);
    t = setRes.json?.token;
    const sw2 = await call('POST', '/auth/switch-role', { role: 'technician', password: 'Secure1234' }, t);
    assert(sw2.status === 200 && sw2.json?.user?.role === 'technician', 'switch-role works after setting a password');
    const sw2b = await call('POST', '/auth/switch-role', { role: 'customer', password: 'wrong-pass-1' }, sw2.json?.token || t);
    assert(sw2b.status === 403 && sw2b.json?.code === 'PASSWORD_CONFIRMATION_FAILED', 'a wrong password is a normal confirmation failure, not PASSWORD_NOT_SET');
    const del2 = await call('DELETE', '/account/me', { password: 'Secure1234' }, sw2.json?.token || t);
    assert(del2.status === 200 && !db.users.some((u) => u.id === 'usr_sp_2'), 'delete-account works after setting a password');

    // ---------------------------------------------------------------- change-password token refresh
    console.log('4. change-password keeps the current session alive');
    const cpTok = (await call('POST', '/auth/login', { emailOrPhone: 'sp1@example.com', password: 'Newpass123' })).json.token;
    const cp = await call('POST', '/auth/change-password', { currentPassword: 'Newpass123', newPassword: 'Changed12345' }, cpTok);
    assert(cp.status === 200 && typeof cp.json?.token === 'string', 'change-password returns a fresh token');
    assert((await call('GET', '/auth/me', undefined, cpTok)).status === 401, 'old token invalid after change-password');
    assert((await call('GET', '/auth/me', undefined, cp.json.token)).status === 200, 'fresh token is valid');
    assert(db.auditLogs.some((a) => a.action === 'PASSWORD_CHANGED' && a.actorId === 'usr_sp_1'), 'change-password is audit logged');
    const cpBad = await call('POST', '/auth/change-password', { currentPassword: 'nope', newPassword: 'Changed99999' }, cp.json.token);
    assert(cpBad.status === 400, 'change-password still needs the correct current password');

    // ---------------------------------------------------------------- public user shape
    console.log('5. Public user shape never leaks the hash');
    const exp = await call('GET', '/account/export-data', undefined, cp.json.token);
    assert(exp.status === 200 && !exp.text.includes('passwordHash') && !exp.text.includes('$2a$') && !exp.text.includes('$2b$') && exp.json?.user?.hasPassword === true, 'account export contains no password hash');
    const login = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' });
    assert(login.json?.user?.hasPassword === true && !login.text.includes('$2'), 'login payload: hasPassword=true, no hash');
    const cprof = await call('PUT', '/customer/profile', { name: 'Tunde A' }, login.json.token);
    assert(cprof.status === 200 && !cprof.text.includes('passwordHash') && !cprof.text.includes('$2a$') && !cprof.text.includes('$2b$'), 'PUT /customer/profile no longer echoes the password hash');

    // ---------------------------------------------------------------- persistence
    console.log('6. Persistence');
    if (!db.isPersistent) await db.init(); // standalone runs: switch on write-through first
    await db.flush();
    const restart = await db.simulateRestartForTests();
    assert(typeof restart === 'object', 'simulated restart completed');
    const reloaded = db.users.find((u) => u.id === 'usr_sp_1') as any;
    assert(!!reloaded && bcrypt.compareSync('Changed12345', reloaded.passwordHash), 'the password hash survives a restart');
    assert((await call('POST', '/auth/login', { emailOrPhone: 'sp1@example.com', password: 'Changed12345' })).status === 200, 'login with the persisted password works after restart');

    // ---------------------------------------------------------------- client logic
    console.log('7. Client logic (ApiClient + helpers)');
    assert(isPasswordNotSetError(new ApiError('x', 403, 'PASSWORD_NOT_SET')) && !isPasswordNotSetError(new ApiError('x', 403, 'PASSWORD_CONFIRMATION_FAILED')) && !isPasswordNotSetError(new Error('x')) && !isPasswordNotSetError(null), 'isPasswordNotSetError recognises only PASSWORD_NOT_SET');
    assert(reauthStep(false, false) === 'set-password', 'reauthStep: known password-less account -> set password first');
    assert(reauthStep(true, false) === 'confirm' && reauthStep(undefined, false) === 'confirm', 'reauthStep: normal account -> confirm password');
    assert(reauthStep(true, true) === 'set-password' && reauthStep(undefined, true) === 'set-password', 'reauthStep: a 403 PASSWORD_NOT_SET always wins');

    let lastReq: { url: string; init: any } | null = null;
    const stubFetch = (status: number, body: any) => {
      (globalThis as any).fetch = async (url: any, init: any) => {
        lastReq = { url: String(url), init };
        return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
      };
    };
    safeStorage.setItem('fixhub_token', 'old-token');
    stubFetch(403, { error: 'Set a password on your account first', code: 'PASSWORD_NOT_SET' });
    let caught: any = null;
    try { await ApiClient.deleteAccount('x'); } catch (e) { caught = e; }
    assert(caught instanceof ApiError && caught.status === 403 && caught.code === 'PASSWORD_NOT_SET' && isPasswordNotSetError(caught), 'ApiClient surfaces status + code of a 403 PASSWORD_NOT_SET');
    assert(safeStorage.getItem('fixhub_token') === 'old-token', 'a 403 does not drop the session token');
    stubFetch(401, { error: 'expired' });
    try { await ApiClient.getMe(); } catch { /* expected */ }
    assert(safeStorage.getItem('fixhub_token') === null, 'a 401 still drops the token');
    safeStorage.setItem('fixhub_token', 'old-token');
    stubFetch(200, { success: true, message: 'ok', token: 'fresh-token' });
    await ApiClient.setPassword('Newpass123');
    assert(lastReq!.url === '/api/auth/set-password' && lastReq!.init.method === 'POST' && JSON.parse(lastReq!.init.body).newPassword === 'Newpass123', 'ApiClient.setPassword posts to /auth/set-password');
    assert(safeStorage.getItem('fixhub_token') === 'fresh-token', 'ApiClient.setPassword stores the fresh token');
    stubFetch(200, { success: true, message: 'ok', token: 'fresh-2' });
    await ApiClient.changePassword({ currentPassword: 'a', newPassword: 'b1234567' });
    assert(safeStorage.getItem('fixhub_token') === 'fresh-2', 'ApiClient.changePassword stores the fresh token');
    safeStorage.removeItem('fixhub_token');
  } catch (err: any) {
    console.error('  [FAIL] set-password test crashed:', err?.stack || err);
    failed++;
  } finally {
    (globalThis as any).fetch = realFetch;
    for (const id of ['usr_sp_1', 'usr_sp_2']) {
      const i = db.users.findIndex((u) => u.id === id);
      if (i >= 0) db.users.splice(i, 1);
    }
    await app.close();
  }

  return { passed, failed };
}

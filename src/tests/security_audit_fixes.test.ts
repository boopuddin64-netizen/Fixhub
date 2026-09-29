/**
 * Regression tests for the security audit fixes (branch fix/security-audit-fixes).
 * Route-level tests mount the real apiRouter on an ephemeral Express app (port 0).
 */
import express from 'express';
import { spawnSync } from 'child_process';
import fs from 'fs';
import nodePath from 'path';
import type { AddressInfo } from 'net';
import { db } from '../../server/db';
import { apiRouter } from '../../server/routes/api';
import { AuthService } from '../../server/services/authService';
import { PaystackClient } from '../../server/services/paystackClient';
import { PaymentService } from '../../server/services/paymentService';
import { makeAsyncSafe } from '../../server/utils/asyncRouter';
import { globalErrorHandler } from '../../server/middleware/errorHandler';

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

    // ---- Fix 2: no demo accounts in production ----
    console.log('Fix 2: demo seed data is not created in production');
    const { getInitialSeedData, shouldSeedDemoData } = await import('../../server/db/seedData');
    const prevEnv = { NODE_ENV: process.env.NODE_ENV, SEED: process.env.SEED_DEMO_DATA };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SEED_DEMO_DATA;
      const prodSeed = getInitialSeedData();
      assert(prodSeed.users.length === 0, 'Production seed contains no users');
      assert(!prodSeed.users.some((u: any) => String(u.email).endsWith('@test.fixhub.local')), 'Production seed has no @test.fixhub.local demo accounts');
      assert(prodSeed.technicianProfiles.length === 0 && prodSeed.customerProfiles.length === 0, 'Production seed has no demo profiles');
      assert(prodSeed.deviceBrands.length > 0 && prodSeed.deviceModels.length > 0, 'Production seed still includes the device catalog');
      process.env.SEED_DEMO_DATA = 'true';
      assert(getInitialSeedData().users.length === 8, 'SEED_DEMO_DATA=true explicitly re-enables the 8 demo users in production');
      process.env.NODE_ENV = 'development';
      process.env.SEED_DEMO_DATA = 'false';
      assert(shouldSeedDemoData() === false, 'SEED_DEMO_DATA=false disables demo data in development');
      delete process.env.SEED_DEMO_DATA;
      assert(getInitialSeedData().users.length === 8, 'Development still seeds the 8 demo users by default');
    } finally {
      if (prevEnv.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv.NODE_ENV;
      if (prevEnv.SEED === undefined) delete process.env.SEED_DEMO_DATA; else process.env.SEED_DEMO_DATA = prevEnv.SEED;
    }

    // ---- Fix 3: GET /technicians/:id is read-only; /technicians/earnings not shadowed ----
    console.log('Fix 3: read-only technician lookup + earnings route order');
    const usersBefore = db.users.length;
    const profilesBefore = db.technicianProfiles.length;
    const unknown = await call('GET', '/technicians/does-not-exist-123');
    assert(unknown.status === 404, 'GET /technicians/<unknown id> returns 404', String(unknown.status));
    const unknownEmail = await call('GET', '/technicians/squatter@example.com');
    assert(unknownEmail.status === 404, 'GET /technicians/<unknown email> returns 404');
    assert(db.users.length === usersBefore && db.technicianProfiles.length === profilesBefore, 'Unknown-id GETs created no users or technician profiles');
    const listAfter = await call('GET', '/technicians');
    assert(Array.isArray(listAfter.json) && listAfter.json.length === profilesBefore, 'Public technician list did not grow');
    const custAsTech = await call('GET', '/technicians/customer@test.fixhub.local');
    assert(custAsTech.status === 404, 'GET /technicians/<existing customer email> does not turn the customer into a technician');
    assert(!db.technicianProfiles.some((t) => t.userId === 'usr_customer_1'), 'No technician profile was created for the customer');
    const knownTech = await call('GET', `/technicians/${db.technicianProfiles[0].userId}`);
    assert(knownTech.status === 200 && !!knownTech.json?.technician, 'GET /technicians/<known id> still returns the technician');
    const earnAnon = await call('GET', '/technicians/earnings');
    assert(earnAnon.status === 401, 'GET /technicians/earnings requires auth (401 unauthenticated)', String(earnAnon.status));
    assert(!db.users.some((u) => u.id === 'earnings'), 'GET /technicians/earnings did not create an "earnings" user');
    const custLogin = await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' });
    const earnCust = await call('GET', '/technicians/earnings', undefined, custLogin.json.token);
    assert(earnCust.status === 403, 'GET /technicians/earnings is technician-only (403 for customer)', String(earnCust.status));
    const techLogin = await call('POST', '/auth/login', { emailOrPhone: 'technician@test.fixhub.local', password: 'password123' });
    const earnTech = await call('GET', '/technicians/earnings', undefined, techLogin.json.token);
    assert(earnTech.status === 200 && !!earnTech.json?.summary && Array.isArray(earnTech.json?.earnings), 'GET /technicians/earnings reaches the earnings handler for a technician');

    // ---- Fix 4: first payment of a newly registered user + async error handling ----
    console.log('Fix 4: first payment for a newly registered customer, async handler errors');
    const reg = AuthService.registerCustomer({ name: 'Fresh Buyer', phone: '+2348011122233', email: 'fresh.buyer@example.com', password: 'Passw0rdX1' });
    assert(!('error' in reg), 'New customer registers');
    if (!('error' in reg)) {
      const newId = reg.user.id;
      const u: any = db.users.find((x) => x.id === newId);
      u.emailVerified = true;
      const sqlBefore = await db.query('SELECT id FROM users WHERE id = $1', [newId]);
      assert(sqlBefore.rows.length === 0, 'Precondition: new user is not yet in the SQL users table');
      const now = new Date().toISOString();
      db.repairRequests.push({ id: 'req_fresh_1', customerId: newId, deviceBrand: 'Samsung', deviceModel: 'S23', deviceType: 'SMARTPHONE', issues: ['CRACKED_SCREEN'], description: 'cracked', photos: [], status: 'REQUESTED', createdAt: now, updatedAt: now, quotesCount: 1, matchedTechnicians: [] } as any);
      db.repairQuotes.push({ id: 'quote_fresh_1', requestId: 'req_fresh_1', technicianId: 'usr_tech_1', technicianName: 'Emeka Okafor', businessName: 'Emeka Phone Labs', technicianPhone: '', technicianRating: 4.9, technicianReviewsCount: 1, distanceKm: 1, partsCost: 20000, laborCost: 10000, otherCost: 0, totalAmount: 30000, estimatedTimeHours: 2, warrantyDays: 30, partsQuality: 'PREMIUM_AFTERMARKET', notes: '', status: 'ACCEPTED', createdAt: now } as any);
      db.repairJobs.push({ id: 'job_fresh_1', requestId: 'req_fresh_1', quoteId: 'quote_fresh_1', customerId: newId, technicianId: 'usr_tech_1', deviceBrand: 'Samsung', deviceModel: 'S23', issues: [], status: 'PAYMENT_PENDING', dropOffCode: 'FX-1111', pickupCode: 'PK-1111', handoffQrToken: 't', originalQuoteAmount: 30000, finalAmount: 30000, platformFeeAmount: 0, technicianPayoutAmount: 0, partsUsed: [], createdAt: now, statusHistory: [] } as any);
      const init = await PaymentService.initializePayment({ repairJobId: 'job_fresh_1', customerId: newId, idempotencyKey: 'idem_fresh_1', customerEmail: 'fresh.buyer@example.com' });
      assert(init.success === true, 'Payment initializes for a newly registered customer');
      if (init.success) {
        let threw = false;
        let vr: any;
        try {
          vr = await PaymentService.verifyPayment({ reference: init.reference, actorId: newId, actorRole: 'customer' });
        } catch (e: any) {
          threw = true;
          console.error('    verify threw:', e?.message);
        }
        assert(!threw, 'First payment verify no longer throws a foreign-key violation');
        assert(vr?.success === true && vr?.payment?.status === 'SUCCESS', 'First payment verify succeeds for a newly registered customer');
        const sqlAfter = await db.query('SELECT id FROM users WHERE id = $1', [newId]);
        assert(sqlAfter.rows.length === 1, 'Customer row is persisted to SQL users at payment time');
        const pays = await db.query('SELECT status FROM payments WHERE customer_id = $1', [newId]);
        assert(pays.rows.length === 1 && pays.rows[0].status === 'SUCCESS', 'Payment row persisted as SUCCESS');
      }
    }
    // async route rejections must produce a 500 and never crash the process
    {
      const { Router } = await import('express');
      const r = makeAsyncSafe(Router());
      r.get('/boom-async', async () => { throw new Error('secret internal detail'); });
      r.get('/boom-reject', (_req, _res, _next) => Promise.reject(new Error('rejected')) as any);
      r.get('/boom-sync', () => { throw new Error('sync'); });
      r.get('/ok', (_req, res) => { res.json({ ok: true }); });
      const a2 = express();
      a2.use('/t', r);
      a2.use(globalErrorHandler);
      const srv = await new Promise<import('http').Server>((resolve) => { const s = a2.listen(0, '127.0.0.1', () => resolve(s)); });
      const base2 = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/t`;
      const origErr = console.error;
      console.error = () => {};
      try {
        const r1 = await fetch(`${base2}/boom-async`);
        const b1 = await r1.text();
        assert(r1.status === 500, 'Async handler that throws returns 500 (process survives)');
        assert(!b1.includes('secret internal detail'), '500 response does not leak the internal error message');
        assert((await fetch(`${base2}/boom-reject`)).status === 500, 'Handler returning a rejected promise returns 500');
        assert((await fetch(`${base2}/boom-sync`)).status === 500, 'Sync throw returns 500');
        assert((await fetch(`${base2}/ok`)).status === 200, 'Server still serves requests after handler failures');
        const badJson = await fetch(`${base2}/ok`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
        assert(badJson.status === 404 || badJson.status === 400, 'Unrouted request handled');
      } finally {
        console.error = origErr;
        await new Promise<void>((resolve) => srv.close(() => resolve()));
      }
    }

    // ---- Fix 5: payments hardening ----
    console.log('Fix 5: payment mode, verify authorization, concurrent initialize');
    {
      const saved = { NODE_ENV: process.env.NODE_ENV, PM: process.env.PAYMENT_MODE, KEY: process.env.PAYSTACK_SECRET_KEY };
      const savedFetch = globalThis.fetch;
      const origWarn = console.warn;
      try {
        delete process.env.PAYMENT_MODE;
        process.env.NODE_ENV = 'production';
        assert(PaystackClient.getPaymentMode() === 'live', 'PAYMENT_MODE defaults to live in production');
        process.env.PAYMENT_MODE = 'sandbox';
        assert(PaystackClient.getPaymentMode() === 'live', 'PAYMENT_MODE=sandbox is ignored (live) in production');
        // Non-OK Paystack answer with a real-looking key must NOT be turned into a simulated success in production
        process.env.PAYSTACK_SECRET_KEY = 'sk_live_' + 'a'.repeat(30);
        (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({ status: false, message: 'Transaction reference not found' }) });
        const prodVerify = await PaystackClient.verifyTransaction('FXP-NOT-PAID', 3000000);
        assert(prodVerify.status === false, 'Production: non-OK Paystack verify does not simulate success');
        (globalThis as any).fetch = async () => { throw new Error('network down'); };
        const prodNet = await PaystackClient.verifyTransaction('FXP-NOT-PAID', 3000000);
        assert(prodNet.status === false, 'Production: Paystack network error does not simulate success');
        // Production with a dummy key refuses (no simulation)
        process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_fixhub_development_key';
        const prodMock = await PaystackClient.verifyTransaction('FXP-NOT-PAID', 3000000);
        assert(prodMock.status === false, 'Production: dummy/mock key cannot verify payments');
        // env validator rejects sandbox mode in production
        const { validateProductionSecrets } = await import('../../server/config/envValidator');
        const goodEnv: any = { NODE_ENV: 'production', PAYSTACK_SECRET_KEY: 'sk_live_' + 'a'.repeat(30), DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(48), SMS_PROVIDER_API_KEY: 'k' };
        const origErr = console.error;
        console.error = () => {};
        let sandboxRejected = false;
        try { validateProductionSecrets({ ...goodEnv, PAYMENT_MODE: 'sandbox' }, false); } catch { sandboxRejected = true; }
        console.error = origErr;
        assert(sandboxRejected, 'Env validator rejects PAYMENT_MODE=sandbox in production');
        assert(validateProductionSecrets({ ...goodEnv, PAYMENT_MODE: 'live' }, false).valid === true, 'Env validator accepts PAYMENT_MODE=live');
      } finally {
        (globalThis as any).fetch = savedFetch;
        console.warn = origWarn;
        if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.NODE_ENV;
        if (saved.PM === undefined) delete process.env.PAYMENT_MODE; else process.env.PAYMENT_MODE = saved.PM;
        if (saved.KEY === undefined) delete process.env.PAYSTACK_SECRET_KEY; else process.env.PAYSTACK_SECRET_KEY = saved.KEY;
      }
    }
    {
      // fresh job for authorization + concurrency checks
      const now = new Date().toISOString();
      db.repairRequests.push({ id: 'req_pay5', customerId: 'usr_customer_1', deviceBrand: 'Apple', deviceModel: 'iPhone 13', deviceType: 'SMARTPHONE', issues: [], description: 'x', photos: [], status: 'REQUESTED', createdAt: now, updatedAt: now, quotesCount: 1, matchedTechnicians: [] } as any);
      db.repairQuotes.push({ id: 'quote_pay5', requestId: 'req_pay5', technicianId: 'usr_tech_1', technicianName: 'Emeka', businessName: 'E', technicianPhone: '', technicianRating: 5, technicianReviewsCount: 1, distanceKm: 1, partsCost: 1000, laborCost: 1000, otherCost: 0, totalAmount: 2000, estimatedTimeHours: 1, warrantyDays: 30, partsQuality: 'PREMIUM_AFTERMARKET', notes: '', status: 'ACCEPTED', createdAt: now } as any);
      db.repairJobs.push({ id: 'job_pay5', requestId: 'req_pay5', quoteId: 'quote_pay5', customerId: 'usr_customer_1', technicianId: 'usr_tech_1', deviceBrand: 'Apple', deviceModel: 'iPhone 13', issues: [], status: 'PAYMENT_PENDING', dropOffCode: 'FX-2222', pickupCode: 'PK-2222', handoffQrToken: 't', originalQuoteAmount: 2000, finalAmount: 2000, platformFeeAmount: 0, technicianPayoutAmount: 0, partsUsed: [], createdAt: now, statusHistory: [] } as any);
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) => PaymentService.initializePayment({ repairJobId: 'job_pay5', customerId: 'usr_customer_1', idempotencyKey: `race_key_${i}`, customerEmail: 'customer@test.fixhub.local' }))
      );
      const ok = results.filter((r) => r.success);
      const ids = new Set(ok.map((r: any) => r.payment.id));
      assert(ok.length === 6 && ids.size === 1, '6 concurrent initializes with different idempotency keys yield ONE payment', `distinct=${ids.size}`);
      assert(db.payments.filter((p) => p.repairId === 'job_pay5').length === 1, 'Only one payment record exists for the job');
      const ref = (ok[0] as any).reference;
      // technicians (even the assigned one) cannot verify a customer's payment
      const techVerify = await PaymentService.verifyPayment({ reference: ref, actorId: 'usr_tech_1', actorRole: 'technician' });
      assert(techVerify.success === false, 'Assigned technician cannot verify the customer payment');
      const otherTech = await PaymentService.verifyPayment({ reference: ref, actorId: 'usr_tech_2', actorRole: 'technician' });
      assert(otherTech.success === false, 'Unrelated technician cannot verify the payment');
      const otherCust = await PaymentService.verifyPayment({ reference: ref, actorId: 'usr_customer_2', actorRole: 'customer' });
      assert(otherCust.success === false, 'Other customer cannot verify the payment');
      assert(db.payments.find((p) => p.transactionRef === ref)?.status === 'INITIATED', 'Rejected verify attempts leave the payment untouched');
      const noActorRole = await PaymentService.verifyPayment({ reference: ref, actorId: 'usr_customer_1' });
      assert(noActorRole.success === false, 'An actorId without a role is not accepted');
      const admin = await PaymentService.verifyPayment({ reference: ref, actorId: 'usr_admin_x', actorRole: 'admin' });
      assert(admin.success === true, 'Admin can verify a payment');
    }
    {
      // via HTTP: technician token gets 400 on verify of somebody else's payment
      const now = new Date().toISOString();
      db.repairJobs.push({ id: 'job_pay5b', requestId: 'req_pay5', quoteId: 'quote_pay5', customerId: 'usr_customer_1', technicianId: 'usr_tech_1', deviceBrand: 'Apple', deviceModel: 'iPhone 13', issues: [], status: 'PAYMENT_PENDING', dropOffCode: 'FX-3333', pickupCode: 'PK-3333', handoffQrToken: 't', originalQuoteAmount: 2000, finalAmount: 2000, platformFeeAmount: 0, technicianPayoutAmount: 0, partsUsed: [], createdAt: now, statusHistory: [] } as any);
      const custTok = (await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' })).json.token;
      const techTok = (await call('POST', '/auth/login', { emailOrPhone: 'technician@test.fixhub.local', password: 'password123' })).json.token;
      const initHttp = await call('POST', '/payments/initialize', { repairJobId: 'job_pay5b', idempotencyKey: 'http_idem_1' }, custTok);
      assert(initHttp.status === 200 && !!initHttp.json?.reference, 'HTTP: customer initializes payment', JSON.stringify(initHttp.json));
      const techHttp = await call('POST', '/payments/verify', { reference: initHttp.json.reference }, techTok);
      assert(techHttp.status === 400, 'HTTP: technician verify of a customer payment is rejected', String(techHttp.status));
      const custHttp = await call('POST', '/payments/verify', { reference: initHttp.json.reference }, custTok);
      assert(custHttp.status === 200 && custHttp.json?.payment?.status === 'SUCCESS', 'HTTP: owning customer can verify (sandbox outside production)');
    }

    // ---- Fix 6: production fail-fast ----
    console.log('Fix 6: production boot fails fast on missing/default secrets');
    {
      const { getJwtSecret } = await import('../../server/services/authService');
      const th = (env: any) => { try { getJwtSecret(env); return false; } catch { return true; } };
      assert(th({ NODE_ENV: 'production' }), 'getJwtSecret throws in production when JWT_SECRET is missing');
      assert(th({ NODE_ENV: 'production', JWT_SECRET: 'fixhub-dev-secret-key-production-change-me' }), 'getJwtSecret throws in production for the default secret');
      assert(th({ NODE_ENV: 'production', JWT_SECRET: 'short' }), 'getJwtSecret throws in production for a short secret');
      assert(!th({ NODE_ENV: 'production', JWT_SECRET: 'z'.repeat(40) }), 'getJwtSecret accepts a strong secret in production');
      assert(!th({ NODE_ENV: 'development' }), 'getJwtSecret keeps the dev default outside production');

      const root = process.cwd();
      const runBoot = (env: Record<string, string>) =>
        spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
          cwd: root,
          env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', NODE_ENV: 'production', PORT: '0', ...env },
          timeout: 45000,
          encoding: 'utf-8',
        });
      const bare = runBoot({});
      assert(bare.status === 1, 'Real server boot with NODE_ENV=production and no secrets exits with status 1', `status=${bare.status} signal=${bare.signal}`);
      const noJwt = runBoot({ PAYSTACK_SECRET_KEY: 'sk_live_' + 'a'.repeat(30), DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x', SMS_PROVIDER_API_KEY: 'k' });
      assert(noJwt.status === 1 && /JWT_SECRET/.test(noJwt.stderr + noJwt.stdout), 'Boot without JWT_SECRET exits 1 and names JWT_SECRET', `status=${noJwt.status}`);
      const defJwt = runBoot({ PAYSTACK_SECRET_KEY: 'sk_live_' + 'a'.repeat(30), DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x', SMS_PROVIDER_API_KEY: 'k', JWT_SECRET: 'fixhub-dev-secret-key-production-change-me' });
      assert(defJwt.status === 1, 'Boot with the default JWT_SECRET exits 1', `status=${defJwt.status}`);
    }

    // ---- Fix 7: schema bootstrap is awaited ----
    console.log('Fix 7: schema creation is awaited');
    {
      const { pgDb } = await import('../../server/db/pgClient');
      let readyOk = true;
      try { await pgDb.ready; } catch { readyOk = false; }
      assert(readyOk, 'pgDb.ready resolves once the schema has been applied');
      const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      const names = new Set(tables.rows.map((r: any) => r.table_name));
      assert(['users', 'payments', 'repair_jobs', 'technician_earnings', 'messages', 'refunds', 'reviews', 'warranties', 'device_models'].every((t) => names.has(t)), 'All core tables exist right after ready (incl. payments, messages, reviews)');
      assert(typeof (pgDb.executeSchema() as any).then === 'function', 'executeSchema() returns a promise (awaitable) and is idempotent');
      await pgDb.executeSchema();
    }

    // ---- Fix 8: SVG stored XSS ----
    console.log('Fix 8: SVG upload blocked, attachments served as downloads');
    const attDir = nodePath.resolve(process.cwd(), './data/attachments');
    const attDirExisted = fs.existsSync(attDir);
    const filesBefore = attDirExisted ? new Set(fs.readdirSync(attDir)) : new Set<string>();
    try {
      const custTok8 = (await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' })).json.token;
      const b64 = (str: string) => Buffer.from(str).toString('base64');
      const svgPayloads: Array<[string, string]> = [
        ['plain svg', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'],
        ['onmouseover', '<svg xmlns="http://www.w3.org/2000/svg" onmouseover="alert(document.domain)" width="500" height="500"><rect width="500" height="500"/></svg>'],
        ['onclick', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="9" height="9" onclick="alert(1)"/></svg>'],
        ['entity-encoded javascript:', '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:alert(1)"><text y="10">x</text></a></svg>'],
        ['animate href', '<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" values="javascript&colon;alert(1)"/><text y="10">x</text></a></svg>'],
        ['xml prolog', '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'],
      ];
      for (const [label, svg] of svgPayloads) {
        const asSvg = await call('POST', '/repairs/attachments/upload', { fileData: `data:image/svg+xml;base64,${b64(svg)}`, type: 'IMAGE', mimeType: 'image/svg+xml' }, custTok8);
        assert(asSvg.status === 415, `SVG upload rejected (${label})`, String(asSvg.status));
      }
      const disguised = await call('POST', '/repairs/attachments/upload', { fileData: b64(svgPayloads[1][1]), type: 'IMAGE', mimeType: 'image/png' }, custTok8);
      assert(disguised.status === 415, 'SVG disguised with a PNG MIME is rejected (content sniffing)', String(disguised.status));
      const htmlAsPng = await call('POST', '/repairs/attachments/upload', { fileData: b64('<!DOCTYPE html><html><script>alert(1)</script></html>'), type: 'IMAGE', mimeType: 'image/png' }, custTok8);
      assert(htmlAsPng.status === 415, 'HTML disguised as PNG is rejected', String(htmlAsPng.status));
      // a real (1x1) PNG still uploads and is served as a hardened download
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const okPng = await call('POST', '/repairs/attachments/upload', { fileData: `data:image/png;base64,${png}`, type: 'IMAGE', mimeType: 'image/png' }, custTok8);
      assert(okPng.status === 201 && /\.png$/.test(okPng.json?.url || ''), 'A legitimate PNG upload still works', JSON.stringify(okPng.json));
      if (okPng.status === 201) {
        const dl = await fetch(`${app.base.replace('/api', '')}${okPng.json.url}`, { headers: { Authorization: `Bearer ${custTok8}`, 'X-Forwarded-For': '10.77.0.1' } });
        assert(dl.status === 200, 'Owner can download the attachment');
        assert(dl.headers.get('x-content-type-options') === 'nosniff', 'Attachment response has X-Content-Type-Options: nosniff');
        assert(/^attachment/.test(dl.headers.get('content-disposition') || ''), 'Attachment response has Content-Disposition: attachment');
        assert(/sandbox/.test(dl.headers.get('content-security-policy') || ''), 'Attachment response has a restrictive CSP (sandbox)');
        assert(dl.headers.get('content-type') === 'image/png', 'Attachment response has the fixed image/png type');
      }
      // legacy SVG already on disk is never served as an image/svg+xml document
      if (!fs.existsSync(attDir)) fs.mkdirSync(attDir, { recursive: true });
      const legacy = 'att_legacy_test.svg';
      fs.writeFileSync(nodePath.join(attDir, legacy), '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
      (db.uploadedAttachments as any[]).push({ id: 'att_legacy_test', type: 'IMAGE', url: `/api/repairs/attachments/${legacy}`, mimeType: 'image/svg+xml', size: 10, createdAt: new Date().toISOString(), ownerId: 'usr_customer_1' });
      const legacyRes = await fetch(`${app.base}/repairs/attachments/${legacy}`, { headers: { Authorization: `Bearer ${custTok8}`, 'X-Forwarded-For': '10.77.0.2' } });
      assert(legacyRes.status === 200 && legacyRes.headers.get('content-type') === 'application/octet-stream' && /^attachment/.test(legacyRes.headers.get('content-disposition') || ''), 'Legacy SVG on disk is served as octet-stream download, not as an SVG document', `${legacyRes.status} ${legacyRes.headers.get('content-type')}`);
    } finally {
      // remove files created by this test (and the folder if we created it)
      if (fs.existsSync(attDir)) {
        for (const f of fs.readdirSync(attDir)) if (!filesBefore.has(f)) fs.unlinkSync(nodePath.join(attDir, f));
        if (!attDirExisted && fs.readdirSync(attDir).length === 0) fs.rmdirSync(attDir);
      }
    }

    // ---- Fix 9: bank-change OTP ----
    console.log('Fix 9: bank-change OTP hardening');
    {
      const { BankOtpService, BANK_OTP_MAX_ATTEMPTS, BANK_OTP_TTL_MS } = await import('../../server/services/bankOtpService');
      // unit level
      const u1 = 'otp_unit_user';
      const a = BankOtpService.issue(u1, 1_000_000);
      assert(a.ok === true && /^\d{6}$/.test(a.code || ''), 'OTP is a 6-digit numeric code');
      assert(BankOtpService.issue(u1, 1_000_000 + 1000).ok === false, 'Re-issuing within the cooldown is refused');
      assert(BankOtpService.verify(u1, a.code, 1_000_000 + BANK_OTP_TTL_MS + 1).reason === 'EXPIRED', 'OTP expires after 10 minutes');
      const b = BankOtpService.issue(u1, 2_000_000);
      let last: any;
      for (let i = 0; i < BANK_OTP_MAX_ATTEMPTS; i++) last = BankOtpService.verify(u1, '000000' === b.code ? '111111' : '000000', 2_000_100);
      assert(last.reason === 'LOCKED', `OTP locks after ${BANK_OTP_MAX_ATTEMPTS} wrong attempts`);
      assert(BankOtpService.verify(u1, b.code, 2_000_200).ok === false, 'Correct code no longer works after lockout (must request a new one)');
      const distinct = new Set<string>();
      for (let i = 0; i < 40; i++) distinct.add(BankOtpService.issue(`otp_dist_${i}`).code as string);
      assert(distinct.size > 30, 'Generated codes are varied');

      // HTTP level (dev)
      const techTok9 = (await call('POST', '/auth/login', { emailOrPhone: 'technician@test.fixhub.local', password: 'password123' })).json.token;
      const req1 = await call('POST', '/technicians/bank/request-change-otp', {}, techTok9);
      assert(req1.status === 200 && /^\d{6}$/.test(req1.json?.devCode || ''), 'Non-production: devCode is returned for local testing');
      const code9 = req1.json.devCode as string;
      const req1b = await call('POST', '/technicians/bank/request-change-otp', {}, techTok9);
      assert(req1b.status === 429, 'Requesting a second code immediately is rate-limited (429)');
      // the code must not leak through the government-id verify response (owner profile)
      const gov = await call('POST', '/technicians/verify/government-id', { idType: 'NIN', idNumber: '98765432101' }, techTok9);
      assert(!JSON.stringify(gov.json).includes(code9) && !/bankChangeVerification/.test(gov.text), 'OTP is not leaked in the government-id verify response');
      const prof = await call('GET', '/auth/me', undefined, techTok9);
      assert(!prof.text.includes(code9), 'OTP is not leaked via /auth/me');
      const pub = await call('GET', '/technicians');
      assert(!pub.text.includes(code9) && !/bankChangeVerification/.test(pub.text), 'OTP is not leaked in the public technician list');
      // wrong guesses are limited
      const wrong = code9 === '123456' ? '654321' : '123456';
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) statuses.push((await call('POST', '/technicians/bank/verify-change-otp', { otp: wrong }, techTok9)).status);
      assert(statuses.slice(0, 4).every((x) => x === 400) && statuses[4] === 429, 'Wrong OTP guesses are capped (400 x4 then 429 lockout)', statuses.join(','));
      const afterLock = await call('POST', '/technicians/bank/verify-change-otp', { otp: code9 }, techTok9);
      assert(afterLock.status === 400 || afterLock.status === 429, 'The original code is dead after lockout', String(afterLock.status));

      // HTTP level (production): no devCode, delivered by SMS
      const savedP = { NODE_ENV: process.env.NODE_ENV, SMS: process.env.SMS_PROVIDER_API_KEY, JWT: process.env.JWT_SECRET };
      const realFetch = globalThis.fetch;
      let smsBody = '';
      try {
        process.env.SMS_PROVIDER_API_KEY = 'test-sms-key';
        (globalThis as any).fetch = async (url: any, init?: any) => {
          if (String(url).includes('sendchamp')) {
            smsBody = String(init?.body || '');
            return { ok: true, json: async () => ({ status: 'success', code: 200 }) };
          }
          return realFetch(url, init);
        };
        process.env.JWT_SECRET = 'j'.repeat(48);
        process.env.NODE_ENV = 'production';
        BankOtpService.clear('usr_tech_2');
        // (demo users are already loaded in memory; just mint a token for one of them)
        const tok2 = AuthService.generateToken(db.users.find((x) => x.id === 'usr_tech_2') as any);
        const pr = await call('POST', '/technicians/bank/request-change-otp', {}, tok2);
        assert(pr.status === 200 && pr.json?.success === true, 'Production: OTP request succeeds via SMS', JSON.stringify(pr.json));
        assert(pr.json && !('devCode' in pr.json), 'Production: devCode is NOT returned');
        const sentCode = (smsBody.match(/\b(\d{6})\b/) || [])[1];
        assert(!!sentCode && !pr.text.includes(sentCode), 'Production: the code is only in the SMS payload, never in the HTTP response');
      } finally {
        (globalThis as any).fetch = realFetch;
        if (savedP.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedP.NODE_ENV;
        if (savedP.SMS === undefined) delete process.env.SMS_PROVIDER_API_KEY; else process.env.SMS_PROVIDER_API_KEY = savedP.SMS;
        if (savedP.JWT === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = savedP.JWT;
      }
    }

    // ---- Fix 10: CORS allow-list ----
    console.log('Fix 10: CORS allow-list');
    {
      const { isOriginAllowed, buildCorsOptions, parseAllowedOrigins } = await import('../../server/config/cors');
      const prod: any = { NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://app.fixhub.ng, https://*.staging.fixhub.ng ,*', APP_URL: 'https://fixhub.example.com/some/path' };
      assert(parseAllowedOrigins(prod).includes('https://app.fixhub.ng') && parseAllowedOrigins(prod).includes('https://fixhub.example.com'), 'ALLOWED_ORIGINS and APP_URL origin are parsed');
      assert(!parseAllowedOrigins(prod).includes('*'), 'A bare * in ALLOWED_ORIGINS is ignored');
      assert(isOriginAllowed('https://app.fixhub.ng', prod), 'Listed origin is allowed');
      assert(isOriginAllowed('https://pr-1.staging.fixhub.ng', prod), 'Explicit wildcard-subdomain entry is honoured');
      assert(!isOriginAllowed('https://evil.example', prod), 'Unlisted origin is denied in production');
      assert(!isOriginAllowed('https://evil.example.run.app', prod), '*.run.app is no longer implicitly trusted');
      assert(!isOriginAllowed('http://localhost:3000', prod), 'localhost is denied in production unless listed');
      assert(!isOriginAllowed('https://staging.fixhub.ng.evil.example', prod), 'Suffix look-alike domains are denied');
      assert(isOriginAllowed(undefined, prod), 'Requests without Origin (same-origin/curl) are unaffected');
      const dev: any = { NODE_ENV: 'development' };
      assert(isOriginAllowed('http://localhost:5173', dev) && isOriginAllowed('http://127.0.0.1:3000', dev), 'Dev defaults allow localhost / 127.0.0.1');
      assert(!isOriginAllowed('https://evil.example', dev), 'Arbitrary origins are denied even in development');
      // end-to-end with the real cors middleware
      const cors = (await import('cors')).default;
      const savedEnv = { NODE_ENV: process.env.NODE_ENV, AO: process.env.ALLOWED_ORIGINS };
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.fixhub.ng';
      const a3 = express();
      a3.use(cors(buildCorsOptions(process.env)));
      a3.get('/x', (_q, r) => { r.json({ ok: 1 }); });
      const srv3 = await new Promise<import('http').Server>((resolve) => { const s3 = a3.listen(0, '127.0.0.1', () => resolve(s3)); });
      const u3 = `http://127.0.0.1:${(srv3.address() as AddressInfo).port}/x`;
      try {
        const evil = await fetch(u3, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
        assert(!evil.headers.get('access-control-allow-origin') && !evil.headers.get('access-control-allow-credentials'), 'Preflight from evil origin gets no ACAO / ACAC headers');
        const good = await fetch(u3, { method: 'OPTIONS', headers: { Origin: 'https://app.fixhub.ng', 'Access-Control-Request-Method': 'GET' } });
        assert(good.headers.get('access-control-allow-origin') === 'https://app.fixhub.ng' && good.headers.get('access-control-allow-credentials') === 'true', 'Preflight from allow-listed origin is granted (with credentials)');
        const evilGet = await fetch(u3, { headers: { Origin: 'https://evil.example' } });
        assert(!evilGet.headers.get('access-control-allow-origin'), 'Simple GET from evil origin gets no ACAO header');
      } finally {
        await new Promise<void>((resolve) => srv3.close(() => resolve()));
        if (savedEnv.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedEnv.NODE_ENV;
        if (savedEnv.AO === undefined) delete process.env.ALLOWED_ORIGINS; else process.env.ALLOWED_ORIGINS = savedEnv.AO;
      }
    }

    // ---- Fix 11: ?token= auth restricted, code endpoints rate limited ----
    console.log('Fix 11: query-token auth restricted; rate limits on code endpoints');
    {
      const tokC = (await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' })).json.token;
      const meQuery = await call('GET', `/auth/me?token=${encodeURIComponent(tokC)}`);
      assert(meQuery.status === 401, 'GET /auth/me?token=<jwt> is no longer accepted', String(meQuery.status));
      const meHeader = await call('GET', '/auth/me', undefined, tokC);
      assert(meHeader.status === 200, 'Authorization header auth still works');
      const postQuery = await call('POST', `/auth/logout?token=${encodeURIComponent(tokC)}`, {});
      assert(postQuery.status === 401, 'POST with ?token= is not accepted');
      const attQuery = await call('GET', `/repairs/attachments/does_not_exist.png?token=${encodeURIComponent(tokC)}`);
      assert(attQuery.status === 404, 'Attachment media route still accepts ?token= (auth passes, file not found -> 404)', String(attQuery.status));
      // verify-email/confirm: brute force is capped from a single IP
      const fixedIp = { 'X-Forwarded-For': '203.0.113.77' };
      const codes: number[] = [];
      for (let i = 0; i < 14; i++) codes.push((await call('POST', '/auth/verify-email/confirm', { code: String(100000 + i) }, undefined, fixedIp)).status);
      assert(codes.slice(0, 10).every((c) => c === 400) && codes.slice(10).every((c) => c === 429), 'verify-email/confirm: 10 guesses then 429', codes.join(','));
      const resetIp = { 'X-Forwarded-For': '203.0.113.78' };
      const rc: number[] = [];
      for (let i = 0; i < 13; i++) rc.push((await call('POST', '/auth/reset-password', { code: String(200000 + i), newPassword: 'Newpass123' }, undefined, resetIp)).status);
      assert(rc.slice(0, 10).every((c) => c === 400) && rc.slice(10).every((c) => c === 429), 'reset-password: 10 guesses then 429', rc.join(','));
      const pc: number[] = [];
      for (let i = 0; i < 13; i++) pc.push((await call('POST', '/auth/verify-phone/confirm', { phoneOrUserId: '+2340000000000', code: String(300000 + i) }, undefined, { 'X-Forwarded-For': '203.0.113.79' })).status);
      assert(pc.slice(0, 10).every((c) => c === 400) && pc.slice(10).every((c) => c === 429), 'verify-phone/confirm: 10 guesses then 429', pc.join(','));
      const sc: number[] = [];
      for (let i = 0; i < 13; i++) sc.push((await call('POST', '/auth/forgot-password', { emailOrPhone: `nobody${i}@example.com` }, undefined, { 'X-Forwarded-For': '203.0.113.80' })).status);
      assert(sc.slice(10).every((c) => c === 429), 'forgot-password (SMS/email trigger) is capped', sc.join(','));
      // body userId cannot be used to trigger a code for somebody else's account
      const smsBefore = (db.users.find((u) => u.id === 'usr_customer_1') as any)?.phone;
      const spoof = await call('POST', '/auth/verify-phone/request', { phoneOrUserId: '+2349999999999', userId: 'usr_customer_1' }, undefined, { 'X-Forwarded-For': '203.0.113.81' });
      assert(spoof.status === 200 && (db.users.find((u) => u.id === 'usr_customer_1') as any)?.phone === smsBefore, 'verify-phone/request ignores a spoofed body userId');
    }

    // <<FIXES>>
  } catch (err: any) {
    assert(false, 'Security audit regression suite threw', err?.stack || err?.message);
  } finally {
    await app.close();
  }

  console.log(`--- Finished Security Audit Fix Tests: ${passed} passed, ${failed} failed ---\n`);
  return { passed, failed };
}

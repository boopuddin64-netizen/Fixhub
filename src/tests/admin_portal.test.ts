/**
 * Admin portal tests (branch feat/admin-portal-and-ux).
 * Mounts the real apiRouter on an ephemeral Express app and drives every /api/admin endpoint over HTTP:
 * 401 for anonymous callers, 403 for customers/technicians, the happy path of each endpoint, an audit entry (with the
 * actor) for every mutation, no password hash / secret anywhere in any response, re-authentication, lockout, session
 * revocation, bootstrap idempotency, the payout-approval flow, CSV safety and persistence across a simulated restart.
 */
import express from 'express';
import type { AddressInfo } from 'net';
import bcrypt from 'bcryptjs';
import { db } from '../../server/db';
import { apiRouter } from '../../server/routes/api';
import { globalErrorHandler } from '../../server/middleware/errorHandler';
import { AuthService } from '../../server/services/authService';
import { PaymentService } from '../../server/services/paymentService';
import { createOrPromoteAdmin, bootstrapAdminFromEnv, adminReauthRequired } from '../../server/services/adminAuthService';
import { computeAdminStats, scrubForAdmin, maskAccountNumber, kycState } from '../../server/routes/modules/adminPortal';
import { csvCell, toCsv } from '../../server/utils/csv';
import { validateAdminPassword, adminPasswordStrength } from '../utils/adminPasswordPolicy';
import {
  buildQueryString, pageInfo, offsetForPage, clampOffset, labelize, describeAuditAction, statusTone, chartGeometry, barWidths,
  filenameFromDisposition, validateConfirmInput, isAdminPath, sectionFromPath, pathForSection, ADMIN_SECTIONS,
} from '../utils/adminUi';

let ipCounter = 1;
const ADMIN_EMAIL = 'ops.lead@fixhub.test';
const ADMIN_PW = 'Zx!9-Strong-Passw0rd';
const ADMIN2_EMAIL = 'ops.second@fixhub.test';
const ADMIN2_PW = 'Qm#7-Another-Str0ngOne';
const ADMIN2_NEW_PW = 'Nw!6-Brand-New-Str0ng';

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
  return { base: `http://127.0.0.1:${port}/api`, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

export async function runAdminPortalTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Admin Portal Tests ---');
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
  const leaks: string[] = [];
  const call = async (method: string, path: string, body?: any, token?: string, opts: { ip?: string } = {}) => {
    const res = await fetch(`${app.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': opts.ip || `10.99.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* csv */ }
    if (/passwordHash|\$2[aby]\$\d\d\$/.test(text)) leaks.push(`${method} ${path}`);
    return { status: res.status, json, text, headers: res.headers };
  };

  const savedReauth = process.env.ADMIN_REQUIRE_REAUTH;
  const savedApproval = process.env.PAYOUT_APPROVAL_REQUIRED;
  try {
    if (!db.isPersistent) await db.init(); // standalone runs: switch on write-through first
    db.resetToSeed();
    delete process.env.ADMIN_REQUIRE_REAUTH;
    delete process.env.PAYOUT_APPROVAL_REQUIRED;

    // ------------------------------------------------------------------ 1. password policy + pure helpers
    console.log('1. Admin password policy & UI helpers');
    assert(validateAdminPassword(ADMIN_PW, { email: ADMIN_EMAIL }) === null, 'strong password accepted');
    const weak: [string, string][] = [
      ['Short1!a', 'too short'], ['alllowercase123!x', 'no upper-case'], ['ALLUPPERCASE123!X', 'no lower-case'],
      ['NoDigitsHere!!Abc', 'no digit'], ['NoSymbolsHere123Abc', 'no symbol'], ['MyFixhub#2026Secure', 'contains "fixhub"'], ['Aaaaa1!bcdefghij', 'repeats a character'],
    ];
    for (const [pw, why] of weak) {
      const msg = validateAdminPassword(pw, { email: ADMIN_EMAIL });
      assert(typeof msg === 'string' && msg.length > 5, `rejects: ${why}`, String(msg));
    }
    assert(validateAdminPassword('Ops.lead#Strong99x', { email: ADMIN_EMAIL }) !== null, 'rejects a password containing the e-mail name');
    assert(validateAdminPassword({ $ne: 1 }) !== null && validateAdminPassword(undefined) !== null, 'non-string passwords rejected');
    assert(adminPasswordStrength('') === 0 && adminPasswordStrength(ADMIN_PW) >= 3, 'strength meter');
    assert(buildQueryString({ q: 'a b', status: '', limit: 25, offset: 0, x: undefined, z: null }) === '?limit=25&offset=0&q=a%20b', 'buildQueryString drops empties, encodes, sorts keys');
    assert(buildQueryString({}) === '', 'empty query -> empty string');
    const pi = pageInfo(101, 25, 100);
    assert(pi.page === 5 && pi.pages === 5 && pi.from === 101 && pi.to === 101 && pi.hasPrev && !pi.hasNext, 'pageInfo on the last, partial page');
    const p0 = pageInfo(0, 25, 0);
    assert(p0.pages === 1 && p0.from === 0 && p0.to === 0 && !p0.hasNext, 'pageInfo on an empty list');
    assert(offsetForPage(3, 25) === 50 && offsetForPage(0, 25) === 0, 'offsetForPage');
    assert(clampOffset(26, 25, 50) === 25 && clampOffset(0, 25, 50) === 0 && clampOffset(100, 25, 25) === 25, 'clampOffset steps back after the last row of a page is removed');
    assert(labelize('PAYMENT_PENDING') === 'Payment pending' && labelize(undefined) === '—', 'labelize');
    assert(describeAuditAction('ADMIN_KYC_APPROVED') === 'KYC approved', 'describeAuditAction keeps acronyms readable');
    assert(statusTone('DISPUTED') === 'red' && statusTone('COMPLETED') === 'green' && statusTone('weird') === 'slate', 'statusTone');
    const g = chartGeometry([0, 5, 10], 100, 50);
    assert(g.points.length === 3 && g.points[2].y < g.points[0].y && chartGeometry([], 100, 50).line === '' && Number.isFinite(chartGeometry([0, 0], 100, 50).points[0].y), 'chartGeometry is safe for empty / all-zero series');
    assert(barWidths([{ key: 'a', value: 4 }, { key: 'b', value: 2 }])[1].pct === 50 && barWidths([{ key: 'a', value: 0 }])[0].pct === 0, 'barWidths');
    assert(filenameFromDisposition('attachment; filename="fixhub-payments-2026-09-30.csv"', 'x.csv') === 'fixhub-payments-2026-09-30.csv' && filenameFromDisposition(null, 'x.csv') === 'x.csv', 'filenameFromDisposition');
    assert(
      validateConfirmInput({ needsReason: true, needsPassword: true }, { reason: 'x', password: '' }) !== null &&
        validateConfirmInput({ needsReason: true, needsPassword: true }, { reason: 'because', password: 'pw' }) === null &&
        validateConfirmInput({ needsReason: false, needsPassword: true }, { reason: '', password: '' }) !== null,
      'confirm-dialog validation mirrors the server'
    );
    assert(isAdminPath('/admin') && isAdminPath('/admin/users') && !isAdminPath('/administrator') && !isAdminPath('/') && !isAdminPath(undefined), 'isAdminPath');
    assert(
      sectionFromPath('/admin/users') === 'users' && sectionFromPath('/admin') === 'dashboard' && sectionFromPath('/admin/nonsense') === 'dashboard' &&
        pathForSection('payouts') === '/admin/payouts' && pathForSection('dashboard') === '/admin',
      'admin routing helpers'
    );
    assert(new Set(ADMIN_SECTIONS.map((s) => s.id)).size === ADMIN_SECTIONS.length, 'section ids are unique');
    assert(
      csvCell('=HYPERLINK("http://evil")').startsWith(`"'=`) && csvCell('+1').startsWith("'+") && csvCell('@x').startsWith("'@") && csvCell(-5) === '-5' &&
        csvCell('a,b') === '"a,b"' && csvCell('say "hi"') === '"say ""hi"""' && csvCell(null) === '',
      'CSV cells: formula-injection guard, quoting, negative numbers stay numeric'
    );
    assert(toCsv([{ a: 1 }], [{ header: 'A', value: (r: any) => r.a }]) === 'A\r\n1\r\n', 'toCsv format');
    assert(maskAccountNumber('0123456789') === '******6789' && maskAccountNumber(undefined) === undefined, 'account numbers masked to last 4');
    const scrubbed: any = scrubForAdmin({ passwordHash: 'x', ok: 1, nested: { codeHash: 'y', accountNumber: '0123456789', list: [{ password: 'z', keep: true }] } });
    assert(
      !('passwordHash' in scrubbed) && scrubbed.ok === 1 && !('codeHash' in scrubbed.nested) && scrubbed.nested.accountNumber === '******6789' &&
        !('password' in scrubbed.nested.list[0]) && scrubbed.nested.list[0].keep === true,
      'scrubForAdmin strips secrets recursively and masks account numbers'
    );

    // ------------------------------------------------------------------ 2. bootstrap
    console.log('\n2. Admin bootstrap (no default admin, idempotent, safe)');
    assert(db.users.filter((u) => u.role === 'admin').length === 0, 'the seed contains NO admin account');
    assert(createOrPromoteAdmin({ email: 'nope', password: ADMIN_PW }).ok === false, 'invalid e-mail rejected');
    assert(createOrPromoteAdmin({ email: ADMIN_EMAIL, password: 'weak' }).ok === false && db.users.filter((u) => u.role === 'admin').length === 0, 'weak password rejected, nothing created');
    const created = createOrPromoteAdmin({ email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PW, name: 'Ops Lead', mustChangePassword: false });
    assert(created.ok && created.status === 'created', 'admin created');
    const adminUser: any = db.users.find((u) => u.email === ADMIN_EMAIL)!;
    assert(!!adminUser && adminUser.role === 'admin' && adminUser.passwordHash.startsWith('$2') && adminUser.passwordHash !== ADMIN_PW && adminUser.emailVerified === true, 'e-mail normalised, password stored only as a bcrypt hash');
    const again = createOrPromoteAdmin({ email: ADMIN_EMAIL, password: 'Diff3rent!Strong#Pw' });
    assert(again.ok && again.status === 'exists' && bcrypt.compareSync(ADMIN_PW, adminUser.passwordHash), 'running it again is a no-op: an existing admin password is NOT overwritten');
    const promoteBlocked = createOrPromoteAdmin({ email: 'customer@test.fixhub.local', password: ADMIN2_PW });
    assert(promoteBlocked.ok === false && db.users.find((u) => u.email === 'customer@test.fixhub.local')!.role === 'customer', 'an existing customer is not silently promoted');
    const promoted = createOrPromoteAdmin({ email: 'ngozi@test.fixhub.local', password: 'Xy$4-Promoted-Adm1n!', promote: true });
    assert(promoted.ok && promoted.status === 'promoted' && db.users.find((u) => u.email === 'ngozi@test.fixhub.local')!.role === 'admin', 'promote=true promotes an existing account');
    {
      const ng: any = db.users.find((u) => u.email === 'ngozi@test.fixhub.local')!;
      ng.role = 'customer'; // keep the fixture small: restore the demo customer exactly as seeded
      ng.passwordHash = bcrypt.hashSync('password123', 8);
      delete ng.mustChangePassword;
    }
    const reset = createOrPromoteAdmin({ email: ADMIN_EMAIL, password: 'Rs!5-Reset-Str0ng-Pw', resetPassword: true, mustChangePassword: true });
    assert(reset.ok && reset.status === 'password_reset' && adminUser.mustChangePassword === true && bcrypt.compareSync('Rs!5-Reset-Str0ng-Pw', adminUser.passwordHash), 'resetPassword sets a new password and forces a change at next login');
    createOrPromoteAdmin({ email: ADMIN_EMAIL, password: ADMIN_PW, resetPassword: true, mustChangePassword: false });
    assert(bootstrapAdminFromEnv({} as any) === null, 'no env -> no bootstrap');
    assert(bootstrapAdminFromEnv({ ADMIN_BOOTSTRAP_EMAIL: 'x@y.com' } as any)?.ok === false, 'half-configured env is reported, not applied');
    const envRes = bootstrapAdminFromEnv({ ADMIN_BOOTSTRAP_EMAIL: ADMIN2_EMAIL, ADMIN_BOOTSTRAP_PASSWORD: ADMIN2_PW, ADMIN_BOOTSTRAP_NAME: 'Second Ops' } as any);
    const admin2: any = db.users.find((u) => u.email === ADMIN2_EMAIL)!;
    assert(envRes?.ok === true && envRes.status === 'created' && admin2.mustChangePassword === true, 'env bootstrap creates the admin and forces a password change');
    const envAgain = bootstrapAdminFromEnv({ ADMIN_BOOTSTRAP_EMAIL: ADMIN2_EMAIL, ADMIN_BOOTSTRAP_PASSWORD: 'Zz!1-Leftover-Env-Pw9' } as any);
    assert(envAgain?.status === 'exists' && bcrypt.compareSync(ADMIN2_PW, admin2.passwordHash), 'a leftover env var can never reset an existing admin password');
    assert(bootstrapAdminFromEnv({ ADMIN_BOOTSTRAP_EMAIL: 'w@y.com', ADMIN_BOOTSTRAP_PASSWORD: 'weak' } as any)?.ok === false, 'env bootstrap enforces the password policy');
    assert(adminReauthRequired({} as any) === true && adminReauthRequired({ ADMIN_REQUIRE_REAUTH: 'false' } as any) === false && adminReauthRequired({ ADMIN_REQUIRE_REAUTH: 'true' } as any) === true, 're-auth is ON by default; only an explicit "false" disables it');

    // ------------------------------------------------------------------ 3. login, lockout, non-admin isolation
    console.log('\n3. Admin sign-in, lockout, isolation from the public login');
    const badLogin = await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: 'nope' });
    const noUser = await call('POST', '/admin/auth/login', { email: 'ghost@nowhere.test', password: 'nope' });
    assert(badLogin.status === 401 && noUser.status === 401 && badLogin.json.error === noUser.json.error, 'wrong password and unknown e-mail give the identical generic error');
    const custViaAdmin = await call('POST', '/admin/auth/login', { email: 'customer@test.fixhub.local', password: 'password123' });
    assert(custViaAdmin.status === 401, 'a customer cannot sign in through /admin/auth/login');
    const publicLoginAsAdmin = await call('POST', '/auth/login', { emailOrPhone: ADMIN_EMAIL, password: ADMIN_PW });
    assert(publicLoginAsAdmin.status !== 200 && !publicLoginAsAdmin.json?.token, 'an admin cannot sign in through the public /auth/login');
    const adminLogin = await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW });
    assert(adminLogin.status === 200 && typeof adminLogin.json.token === 'string' && adminLogin.json.mustChangePassword === false && adminLogin.json.user.role === 'admin', 'admin signs in');
    assert(!adminLogin.text.includes('passwordHash') && adminLogin.headers.get('cache-control') === 'no-store', 'login response has no hash and is not cacheable');
    const adminToken: string = adminLogin.json.token;
    const decoded: any = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64url').toString());
    assert(decoded.exp - decoded.iat <= 8 * 3600 + 5, 'admin tokens expire within 8 hours');
    assert(adminUser.lastLoginAt !== undefined, 'lastLoginAt recorded');

    createOrPromoteAdmin({ email: 'lock.me@fixhub.test', password: 'Lk!3-Lockable-Str0ng', mustChangePassword: false });
    let last: any = null;
    for (let i = 0; i < 5; i++) last = await call('POST', '/admin/auth/login', { email: 'lock.me@fixhub.test', password: 'wrong' + i }, undefined, { ip: '10.77.1.1' });
    const afterLock = await call('POST', '/admin/auth/login', { email: 'lock.me@fixhub.test', password: 'Lk!3-Lockable-Str0ng' }, undefined, { ip: '10.77.1.2' });
    assert(last.status === 401 && afterLock.status === 401, 'after 5 wrong passwords the account is locked even for the right password (from another IP)');
    assert(afterLock.json.error === badLogin.json.error, 'a locked account answers exactly like a wrong password (no enumeration)');
    (db.users.find((u) => u.email === 'lock.me@fixhub.test') as any).adminLockedUntil = new Date(Date.now() - 1000).toISOString();
    const afterExpiry = await call('POST', '/admin/auth/login', { email: 'lock.me@fixhub.test', password: 'Lk!3-Lockable-Str0ng' }, undefined, { ip: '10.77.1.3' });
    assert(afterExpiry.status === 200, 'the lock expires');
    assert(db.auditLogs.some((a) => a.action === 'ADMIN_LOGIN_LOCKED' || a.action === 'ADMIN_LOGIN_FAILED'), 'failed admin logins against a real admin are audited');
    assert(!db.auditLogs.some((a) => JSON.stringify(a.details || {}).includes('ghost@nowhere.test')), 'floods against unknown accounts are NOT written to the audit log');
    let limited = 0;
    for (let i = 0; i < 12; i++) {
      const r = await call('POST', '/admin/auth/login', { email: 'ghost@nowhere.test', password: 'x' }, undefined, { ip: '10.66.6.6' });
      if (r.status === 429) limited++;
    }
    assert(limited >= 1, 'admin login is rate limited per IP after 10 failures');

    // ------------------------------------------------------------------ 4. authn / authz on every endpoint
    console.log('\n4. Every admin endpoint: 401 anonymous, 403 customer/technician');
    const custToken = (await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' })).json?.token as string;
    const techToken = (await call('POST', '/auth/login', { emailOrPhone: 'technician@test.fixhub.local', password: 'password123' })).json?.token as string;
    assert(!!custToken && !!techToken, 'customer and technician fixtures can sign in');
    const endpoints: [string, string][] = [
      ['GET', '/admin/me'], ['GET', '/admin/config'], ['GET', '/admin/stats'], ['GET', '/admin/users'], ['GET', '/admin/technicians'], ['GET', '/admin/users/usr_customer_1'],
      ['GET', '/admin/technicians/usr_tech_1'], ['GET', '/admin/admins'], ['POST', '/admin/users/usr_customer_1/suspend'], ['POST', '/admin/users/usr_customer_1/reactivate'],
      ['POST', '/admin/users/usr_customer_1/revoke-sessions'], ['POST', '/admin/technicians/usr_tech_1/kyc'], ['GET', '/admin/jobs'], ['GET', '/admin/jobs/x'], ['GET', '/admin/jobs/x/messages'],
      ['POST', '/admin/jobs/x/force-status'], ['GET', '/admin/disputes'], ['POST', '/admin/disputes/x/resolve'], ['GET', '/admin/risk-events'], ['POST', '/admin/risk-events/x/review'],
      ['GET', '/admin/payments'], ['GET', '/admin/payments/x'], ['POST', '/admin/payments/reconcile'], ['POST', '/admin/payments/x/refund'], ['GET', '/admin/refunds'], ['GET', '/admin/escrow'],
      ['GET', '/admin/payouts'], ['POST', '/admin/payouts/x/approve'], ['POST', '/admin/payouts/x/reject'], ['GET', '/admin/reviews'], ['POST', '/admin/reviews/x/hide'],
      ['POST', '/admin/reviews/x/unhide'], ['DELETE', '/admin/reviews/x'], ['GET', '/admin/audit-logs'], ['GET', '/admin/announcements'], ['POST', '/admin/announcements'],
      ['GET', '/admin/export/payments.csv'], ['POST', '/admin/auth/logout'], ['POST', '/admin/auth/change-password'], ['POST', '/admin/auth/logout-all'],
      ['POST', '/admin/technicians/usr_tech_1/verify'], ['POST', '/payments/refund'], ['POST', '/payments/reconcile'],
    ];
    let bad401 = '';
    let bad403 = '';
    for (const [m, p] of endpoints) {
      const anon = await call(m, p, m === 'GET' ? undefined : {});
      if (anon.status !== 401) bad401 += ` ${m} ${p}=${anon.status}`;
      for (const t of [custToken, techToken]) {
        const r = await call(m, p, m === 'GET' ? undefined : {}, t);
        if (r.status !== 403) bad403 += ` ${m} ${p}=${r.status}`;
      }
    }
    assert(bad401 === '', `all ${endpoints.length} endpoints reject anonymous callers with 401`, bad401);
    assert(bad403 === '', `all ${endpoints.length} endpoints reject customers and technicians with 403`, bad403);
    const forged = await call('GET', '/admin/stats', undefined, AuthService.generateToken({ ...db.users.find((u) => u.id === 'usr_customer_1')!, role: 'admin' } as any));
    assert(forged.status === 403, 'a token that CLAIMS role=admin for a customer is rejected (role comes from the database)');
    assert((await call('GET', '/admin/stats', undefined, 'garbage.token.value')).status === 401, 'garbage token -> 401');

    // ------------------------------------------------------------------ 5. must-change-password gate
    console.log('\n5. Forced password change');
    const gateLogin = await call('POST', '/admin/auth/login', { email: ADMIN2_EMAIL, password: ADMIN2_PW });
    assert(gateLogin.status === 200 && gateLogin.json.mustChangePassword === true, 'bootstrap admin is told to change the password');
    const gated = await call('GET', '/admin/stats', undefined, gateLogin.json.token);
    assert(gated.status === 403 && gated.json.code === 'PASSWORD_CHANGE_REQUIRED', 'everything except /me and change-password is blocked until the password is changed');
    assert((await call('GET', '/admin/me', undefined, gateLogin.json.token)).status === 200, '/admin/me still works so the UI can show the change-password screen');
    assert((await call('POST', '/admin/auth/change-password', { currentPassword: ADMIN2_PW, newPassword: 'short' }, gateLogin.json.token)).status === 400, 'a weak new password is refused');
    assert((await call('POST', '/admin/auth/change-password', { currentPassword: ADMIN2_PW, newPassword: ADMIN2_PW }, gateLogin.json.token)).status === 400, 'the new password must differ from the old one');
    assert((await call('POST', '/admin/auth/change-password', { currentPassword: 'wrong', newPassword: ADMIN2_NEW_PW }, gateLogin.json.token)).status === 403, 'the current password must be right');
    const okChange = await call('POST', '/admin/auth/change-password', { currentPassword: ADMIN2_PW, newPassword: ADMIN2_NEW_PW }, gateLogin.json.token);
    assert(okChange.status === 200 && okChange.json.token && admin2.mustChangePassword === false, 'password changed, gate lifted');
    assert((await call('GET', '/admin/stats', undefined, gateLogin.json.token)).status === 401, 'the old session was revoked by the password change');
    assert((await call('GET', '/admin/stats', undefined, okChange.json.token)).status === 200, 'the fresh token works');
    const auditOf = (action: string) => db.auditLogs.filter((a) => a.action === action);
    assert(auditOf('ADMIN_PASSWORD_CHANGED').some((a) => a.actorId === admin2.id && a.actorRole === 'admin'), 'password change audited with the actor');

    // ------------------------------------------------------------------ 6. fixtures
    console.log('\n6. Build marketplace fixtures');
    let fx = 0;
    const makePaidJob = async (amount: number, customerId = 'usr_customer_1', techId = 'usr_tech_1') => {
      fx++;
      const now = new Date().toISOString();
      db.repairQuotes.push({ id: `quote_ap_${fx}`, requestId: `req_ap_${fx}`, technicianId: techId, technicianName: 'Emeka Okafor', businessName: 'Emeka Phone Labs', technicianPhone: '+2348025550101', technicianRating: 4.9, technicianReviewsCount: 10, distanceKm: 1, partsCost: amount - 5000, laborCost: 5000, otherCost: 0, totalAmount: amount, estimatedTimeHours: 2, warrantyDays: 60, partsQuality: 'PREMIUM_AFTERMARKET', notes: 'fx', status: 'ACCEPTED', createdAt: now } as any);
      const job: any = {
        id: `job_ap_${fx}`, requestId: `req_ap_${fx}`, quoteId: `quote_ap_${fx}`, customerId, technicianId: techId, deviceBrand: 'Apple', deviceModel: `iPhone ${10 + fx}`, issues: ['screen_damaged'],
        status: 'PAYMENT_PENDING', dropOffCode: `FX-${fx}000`, pickupCode: `PK-${fx}000`, handoffQrToken: `tok_${fx}`, originalQuoteAmount: amount, finalAmount: amount,
        platformFeeAmount: Math.round(amount * 0.085), technicianPayoutAmount: amount - Math.round(amount * 0.085), partsUsed: [], createdAt: now, bookedAt: now,
        statusHistory: [{ status: 'PAYMENT_PENDING', timestamp: now, actorRole: 'customer' }],
      };
      db.repairJobs.push(job);
      const init: any = await PaymentService.initializePayment({ repairJobId: job.id, customerId, idempotencyKey: `idem_ap_${fx}`, paymentMethod: 'CARD', customerEmail: 'customer@test.fixhub.local' });
      const ver: any = await PaymentService.verifyPayment({ reference: init.reference, actorId: customerId, actorRole: 'customer' });
      return { job, payment: init.payment as any, ok: Boolean(init.success && ver.success) };
    };
    const A = await makePaidJob(60000);
    const B = await makePaidJob(40000);
    const C = await makePaidJob(30000);
    const D = await makePaidJob(20000);
    assert(A.ok && B.ok && C.ok && D.ok, 'four paid jobs created through the real payment service');
    db.reviews.push({ id: 'rev_ap_1', repairId: A.job.id, customerId: 'usr_customer_1', customerName: 'Tunde Adebayo', technicianId: 'usr_tech_1', rating: 1, comment: 'Terrible <b>service</b> =cmd()', verifiedPurchase: true, repairSummary: 'x', createdAt: new Date().toISOString() });
    db.reviews.push({ id: 'rev_ap_2', repairId: B.job.id, customerId: 'usr_customer_1', customerName: 'Tunde Adebayo', technicianId: 'usr_tech_1', rating: 5, comment: 'Great', verifiedPurchase: true, repairSummary: 'x', createdAt: new Date().toISOString() });
    db.riskEvents.push({ id: 'risk_ap_1', actorId: 'usr_tech_1', eventType: 'QUOTE_PRICE_ANOMALY', severity: 'HIGH', metadata: { note: 'test' }, reviewed: false, timestamp: new Date().toISOString() });

    // ------------------------------------------------------------------ 7. dashboard + read endpoints
    console.log('\n7. Dashboard stats and read endpoints');
    const me = await call('GET', '/admin/me', undefined, adminToken);
    assert(me.status === 200 && me.json.user.email === ADMIN_EMAIL && me.json.config.reauthRequired === true, '/admin/me returns the admin and the security config');
    const cfg = await call('GET', '/admin/config', undefined, adminToken);
    assert(cfg.status === 200 && typeof cfg.json.commissionPercent === 'number', '/admin/config');
    const stats = await call('GET', '/admin/stats', undefined, adminToken);
    const s = stats.json;
    assert(stats.status === 200 && s.users.total === db.users.length && s.users.admins >= 3 && s.technicians.total === db.technicianProfiles.length, 'stats: user and technician counts');
    assert(s.jobs.total === db.repairJobs.length && Object.values(s.jobs.byStatus as Record<string, number>).reduce((a, b) => a + b, 0) === db.repairJobs.length, 'stats: jobs by status sums to the total');
    const paidTotal = [A, B, C, D].reduce((n, x) => n + x.job.finalAmount, 0);
    assert(s.money.gmvNaira >= paidTotal && s.money.escrowHeldNaira >= paidTotal, 'stats: GMV and escrow held include the paid jobs', JSON.stringify(s.money));
    assert(s.money.platformFeesPendingNaira >= Math.round(60000 * 0.085), 'stats: pending platform fees');
    assert(Array.isArray(s.trend) && s.trend.length === 14 && s.trend[13].jobs >= 4, 'stats: 14-day trend with today at the end');
    assert(s.risk.unreviewedRiskEvents >= 1 && typeof s.payouts.awaitingApproval === 'number' && typeof s.refunds.count === 'number', 'stats: risk, payouts and refunds blocks');
    assert(computeAdminStats().money.gmvNaira === s.money.gmvNaira, 'computeAdminStats is deterministic');

    const users = await call('GET', '/admin/users?limit=3&offset=0', undefined, adminToken);
    assert(users.status === 200 && users.json.length === 3 && Number(users.headers.get('x-total-count')) === db.users.length && users.headers.get('x-limit') === '3', 'users: paginated with X-Total-Count / X-Limit / X-Offset');
    assert(users.json.every((u: any) => !('passwordHash' in u) && u.status), 'users: rows carry status and never a hash');
    const search = await call('GET', '/admin/users?q=ngozi', undefined, adminToken);
    assert(search.json.length === 1 && search.json[0].id === 'usr_customer_2', 'users: search by name/e-mail');
    assert((await call('GET', '/admin/users?role=technician', undefined, adminToken)).json.every((u: any) => u.role === 'technician'), 'users: role filter');
    assert((await call('GET', '/admin/users?role=admin', undefined, adminToken)).json.length >= 3, 'users: admin filter');
    const sortA = (await call('GET', '/admin/users?sort=name&order=asc', undefined, adminToken)).json;
    assert(sortA[0].name.toLowerCase() <= sortA[1].name.toLowerCase(), 'users: sort by name');
    assert((await call('GET', '/admin/users?from=not-a-date', undefined, adminToken)).status === 400, 'users: invalid date filter -> 400');
    assert((await call('GET', '/admin/users?from=2999-01-01', undefined, adminToken)).json.length === 0, 'users: date filter');
    const allTechs = (await call('GET', '/admin/technicians', undefined, adminToken)).json;
    const kycTarget: string = (allTechs.find((t: any) => t.technician.kycStatus === 'VERIFIED') || allTechs[0]).technician.kycStatus;
    const techs = await call('GET', `/admin/technicians?kyc=${kycTarget}`, undefined, adminToken);
    assert(techs.status === 200 && techs.json.length >= 1 && techs.json.every((t: any) => t.role === 'technician' && t.technician.kycStatus === kycTarget), 'technicians: KYC filter');
    assert(techs.json.every((t: any) => !JSON.stringify(t).includes('accountNumber')), 'technician list rows do not include bank data');
    const ud = await call('GET', '/admin/users/usr_customer_1', undefined, adminToken);
    assert(ud.status === 200 && ud.json.user.id === 'usr_customer_1' && ud.json.stats.jobs >= 3 && Array.isArray(ud.json.recentJobs), 'user detail: profile, stats, recent jobs');
    const td = await call('GET', '/admin/technicians/usr_tech_1', undefined, adminToken);
    assert(td.status === 200 && td.json.technicianProfile?.userId === 'usr_tech_1' && td.json.technicianProfile.bankDetails.accountNumber === '******6789', 'technician detail masks the bank account number');
    assert((await call('GET', '/admin/users/nope', undefined, adminToken)).status === 404 && (await call('GET', '/admin/technicians/usr_customer_1', undefined, adminToken)).status === 404, 'detail 404s');
    assert((await call('GET', '/admin/admins', undefined, adminToken)).json.length >= 3, 'admins list');

    const jobs = await call('GET', '/admin/jobs?limit=2', undefined, adminToken);
    assert(jobs.status === 200 && jobs.json.length === 2 && Number(jobs.headers.get('x-total-count')) === db.repairJobs.length, 'jobs: paginated');
    assert((await call('GET', `/admin/jobs?q=${encodeURIComponent('iPhone 11')}`, undefined, adminToken)).json.some((j: any) => j.id === A.job.id), 'jobs: text search');
    assert((await call('GET', '/admin/jobs?status=DISPUTED', undefined, adminToken)).json.length === 0, 'jobs: status filter (none disputed yet)');
    assert((await call('GET', '/admin/jobs?sort=amount&order=desc', undefined, adminToken)).json[0].amountNaira >= 60000, 'jobs: sort by amount');
    const jd = await call('GET', `/admin/jobs/${A.job.id}`, undefined, adminToken);
    assert(jd.status === 200 && jd.json.job.id === A.job.id && jd.json.payments.length === 1 && jd.json.allowedActions.dispute === true, 'job detail: payments and allowed actions');
    assert(!jd.text.includes(A.job.dropOffCode) && !jd.text.includes(A.job.pickupCode) && !jd.text.includes('tok_'), 'job detail hides hand-off codes and QR tokens');
    assert((await call('GET', '/admin/jobs/none', undefined, adminToken)).status === 404, 'job 404');
    db.messages.push({ id: 'msg_ap_1', repairId: A.job.id, senderId: 'usr_customer_1', senderRole: 'customer', senderName: 'Tunde', text: 'hello', createdAt: new Date().toISOString() });
    const msgs = await call('GET', `/admin/jobs/${A.job.id}/messages`, undefined, adminToken);
    assert(msgs.status === 200 && msgs.json.length === 1 && auditOf('ADMIN_VIEWED_JOB_MESSAGES').some((a) => a.resourceId === A.job.id && a.actorId === adminUser.id), 'chat transcript is readable by admins and the read is audited');

    const pays = await call('GET', '/admin/payments?status=ESCROW_HELD,SUCCESS', undefined, adminToken);
    assert(pays.status === 200 && pays.json.length >= 4 && Number(pays.headers.get('x-total-count')) >= 4, 'payments: list + status filter');
    assert(!pays.text.includes('authorizationUrl') && !pays.text.includes('accessCode') && !pays.text.includes('idempotencyKey'), 'payments: gateway secrets are stripped');
    const pd = await call('GET', `/admin/payments/${A.payment.id}`, undefined, adminToken);
    assert(pd.status === 200 && pd.json.payment.id === A.payment.id && pd.json.job.id === A.job.id, 'payment detail');
    assert((await call('GET', `/admin/payments?q=${A.payment.transactionRef}`, undefined, adminToken)).json.length === 1, 'payments: search by reference');
    assert((await call('GET', '/admin/escrow?status=HELD', undefined, adminToken)).json.length >= 4, 'escrow ledger');
    assert((await call('GET', '/admin/refunds', undefined, adminToken)).status === 200 && (await call('GET', '/admin/payouts', undefined, adminToken)).status === 200, 'refunds and payouts ledgers respond');
    assert((await call('GET', '/admin/risk-events?reviewed=false', undefined, adminToken)).json.some((r: any) => r.id === 'risk_ap_1'), 'risk events: unreviewed filter');
    assert((await call('GET', '/admin/reviews?rating=1', undefined, adminToken)).json.length === 1, 'reviews: rating filter');

    // ------------------------------------------------------------------ 8. mutations: re-auth + audit
    console.log('\n8. Mutations require re-auth and are audited with the actor');
    const mut = (m: string, p: string, body: any) => call(m, p, { adminPassword: ADMIN_PW, ...body }, adminToken);
    const noPw = await call('POST', '/admin/users/usr_customer_2/suspend', { reason: 'test suspension' }, adminToken);
    assert(noPw.status === 403 && noPw.json.code === 'ADMIN_REAUTH_FAILED' && db.users.find((u) => u.id === 'usr_customer_2')!.status !== 'suspended', 'suspend without the admin password is refused');
    assert((await call('POST', '/admin/users/usr_customer_2/suspend', { reason: 'test suspension', adminPassword: 'wrong' }, adminToken)).status === 403, 'suspend with a wrong admin password is refused');
    assert((await mut('POST', '/admin/users/usr_customer_2/suspend', { reason: '' })).status === 400, 'suspend requires a reason');
    assert((await mut('POST', `/admin/users/${adminUser.id}/suspend`, { reason: 'self' })).status === 400, 'an admin cannot suspend themselves');

    const ngToken = (await call('POST', '/auth/login', { emailOrPhone: 'ngozi@test.fixhub.local', password: 'password123' })).json.token;
    assert((await call('GET', '/auth/me', undefined, ngToken)).status === 200, 'fixture: customer 2 has a working session');
    const sus = await mut('POST', '/admin/users/usr_customer_2/suspend', { reason: 'Chargeback abuse' });
    assert(sus.status === 200 && sus.json.user.status === 'suspended' && sus.json.user.suspendedReason === 'Chargeback abuse', 'suspend works');
    assert((await call('GET', '/auth/me', undefined, ngToken)).status === 401, 'suspension revokes the existing session immediately');
    const suspLogin = await call('POST', '/auth/login', { emailOrPhone: 'ngozi@test.fixhub.local', password: 'password123' });
    assert(suspLogin.status !== 200 && !suspLogin.json?.token, 'a suspended user cannot log in');
    assert((await mut('POST', '/admin/users/usr_customer_2/suspend', { reason: 'again' })).status === 409, 'suspending twice -> 409');
    const susAudit = auditOf('ADMIN_USER_SUSPENDED').find((a) => a.resourceId === 'usr_customer_2');
    assert(!!susAudit && susAudit.actorId === adminUser.id && susAudit.actorRole === 'admin' && (susAudit.details as any).reason === 'Chargeback abuse', 'suspension audited with actor, role and reason');
    assert((await call('GET', '/admin/users?status=suspended', undefined, adminToken)).json.some((u: any) => u.id === 'usr_customer_2'), 'suspended filter');
    const react = await call('POST', '/admin/users/usr_customer_2/reactivate', { reason: 'appeal accepted' }, adminToken);
    assert(react.status === 200 && react.json.user.status === 'active' && !react.json.user.suspendedReason, 'reactivate works (audited)');
    assert(auditOf('ADMIN_USER_REACTIVATED').some((a) => a.resourceId === 'usr_customer_2' && a.actorId === adminUser.id), 'reactivation audited');
    assert((await call('POST', '/auth/login', { emailOrPhone: 'ngozi@test.fixhub.local', password: 'password123' })).status === 200, 'reactivated user can log in again');
    assert((await call('POST', '/admin/users/usr_customer_2/reactivate', {}, adminToken)).status === 409, 'reactivating an active user -> 409');

    const publicBefore = (await call('GET', '/technicians')).json.map((t: any) => t.userId);
    await mut('POST', '/admin/users/usr_tech_2/suspend', { reason: 'fraud investigation' });
    const publicAfter = (await call('GET', '/technicians')).json.map((t: any) => t.userId);
    assert(publicBefore.includes('usr_tech_2') && !publicAfter.includes('usr_tech_2'), 'a suspended technician is hidden from the public technician list');
    await call('POST', '/admin/users/usr_tech_2/reactivate', {}, adminToken);

    const custSess = (await call('POST', '/auth/login', { emailOrPhone: 'customer@test.fixhub.local', password: 'password123' })).json.token;
    assert((await mut('POST', '/admin/users/usr_customer_1/revoke-sessions', {})).status === 200 && (await call('GET', '/auth/me', undefined, custSess)).status === 401, 'revoke-sessions signs the user out everywhere');
    assert(auditOf('ADMIN_SESSIONS_REVOKED').some((a) => a.resourceId === 'usr_customer_1' && a.actorId === adminUser.id), 'revoke-sessions audited');

    // KYC
    const kycRej = await mut('POST', '/admin/technicians/usr_tech_3/kyc', { decision: 'REJECT', reason: 'ID photo is blurry' });
    assert(kycRej.status === 200 && kycRej.json.kycStatus === 'REJECTED' && db.technicianProfiles.find((t) => t.userId === 'usr_tech_3')!.isVerified === false, 'KYC reject');
    assert((await mut('POST', '/admin/technicians/usr_tech_3/kyc', { decision: 'REJECT' })).status === 400, 'KYC reject requires a reason');
    assert((await mut('POST', '/admin/technicians/usr_tech_3/kyc', { decision: 'MAYBE' })).status === 400, 'KYC decision validated');
    assert(kycState(db.technicianProfiles.find((t) => t.userId === 'usr_tech_3')!) === 'REJECTED', 'kycState reports REJECTED');
    assert(auditOf('ADMIN_KYC_REJECTED').some((a) => a.resourceId === 'usr_tech_3' && a.actorId === adminUser.id), 'KYC rejection audited');
    assert(db.notifications.some((n) => n.userId === 'usr_tech_3' && n.title.includes('Not Approved')), 'the technician is notified of the rejection');
    const kycOk = await mut('POST', '/admin/technicians/usr_tech_3/kyc', { decision: 'APPROVE', reason: 'Documents verified' });
    assert(kycOk.status === 200 && kycOk.json.kycStatus === 'VERIFIED' && db.technicianProfiles.find((t) => t.userId === 'usr_tech_3')!.isVerified === true, 'KYC approve');
    assert(auditOf('ADMIN_KYC_APPROVED').some((a) => a.resourceId === 'usr_tech_3'), 'KYC approval audited');
    assert((await call('GET', '/admin/technicians?kyc=REJECTED', undefined, adminToken)).status === 200, 'kyc filter accepts REJECTED');
    const auditsBeforeLegacy = db.auditLogs.length;
    const legacy = await call('POST', '/admin/technicians/nobody/verify', { adminPassword: ADMIN_PW }, adminToken);
    assert(legacy.status === 404 && !db.users.some((u) => u.id === 'nobody'), 'legacy verify endpoint no longer creates users for unknown ids');
    const legacyOk = await call('POST', '/admin/technicians/usr_tech_4/verify', { isVerified: true, adminPassword: ADMIN_PW }, adminToken);
    assert(legacyOk.status === 200 && db.auditLogs.length > auditsBeforeLegacy && db.auditLogs.slice(auditsBeforeLegacy).some((a) => a.resourceId === 'usr_tech_4' && a.actorId === adminUser.id), 'legacy verify still works and is audited with the actor');
    assert((await call('POST', '/admin/technicians/usr_tech_4/verify', { isVerified: true }, adminToken)).status === 403, 'legacy verify without the admin password is refused');

    // reviews
    const hide = await mut('POST', '/admin/reviews/rev_ap_1/hide', { reason: 'Contains a slur' });
    assert(hide.status === 200 && db.reviews.find((r) => r.id === 'rev_ap_1')!.hidden === true, 'review hidden');
    assert(!(await call('GET', '/reviews/technician/usr_tech_1')).json.some((r: any) => r.id === 'rev_ap_1'), 'a hidden review disappears from the public list');
    assert(auditOf('ADMIN_REVIEW_HIDDEN').some((a) => a.resourceId === 'rev_ap_1' && a.actorId === adminUser.id), 'review hide audited');
    assert((await call('GET', '/admin/reviews?hidden=true', undefined, adminToken)).json.length === 1, 'admin can still see hidden reviews');
    const unhide = await call('POST', '/admin/reviews/rev_ap_1/unhide', { reason: 'appeal' }, adminToken);
    assert(unhide.status === 200 && !db.reviews.find((r) => r.id === 'rev_ap_1')!.hidden, 'review restored');
    assert(auditOf('ADMIN_REVIEW_RESTORED').some((a) => a.resourceId === 'rev_ap_1'), 'review restore audited');
    await mut('POST', '/admin/reviews/rev_ap_1/hide', { reason: 'Contains a slur' });
    const delRev = await mut('DELETE', '/admin/reviews/rev_ap_2', { reason: 'Fake review' });
    assert(delRev.status === 200 && !db.reviews.some((r) => r.id === 'rev_ap_2'), 'review deleted');
    assert(auditOf('ADMIN_REVIEW_REMOVED').some((a) => a.resourceId === 'rev_ap_2' && (a.details as any).snapshot?.comment === 'Great'), 'deleted review is snapshotted in the audit log');
    assert((await mut('POST', '/admin/reviews/nope/hide', { reason: 'x y z' })).status === 404, 'review 404');

    // risk events
    const riskRes = await call('POST', '/admin/risk-events/risk_ap_1/review', { note: 'looked, fine' }, adminToken);
    assert(riskRes.status === 200 && db.riskEvents.find((r) => r.id === 'risk_ap_1')!.reviewedBy === adminUser.id, 'risk event reviewed with reviewer id');
    assert(auditOf('ADMIN_RISK_EVENT_REVIEWED').some((a) => a.resourceId === 'risk_ap_1' && a.actorId === adminUser.id), 'risk review audited');
    assert((await call('POST', '/admin/risk-events/risk_ap_1/review', {}, adminToken)).status === 409, 'a risk event can be reviewed once');

    // ------------------------------------------------------------------ 9. jobs, disputes, refunds
    console.log('\n9. Job force-actions, disputes, refunds');
    assert((await mut('POST', `/admin/jobs/${B.job.id}/force-status`, { status: 'COMPLETED', reason: 'skip' })).status === 400, 'admins cannot force arbitrary statuses (only CANCELLED / DISPUTED)');
    assert((await call('POST', `/admin/jobs/${B.job.id}/force-status`, { status: 'DISPUTED', reason: 'no password' }, adminToken)).status === 403, 'force-status needs the admin password');
    const disp = await mut('POST', `/admin/jobs/${B.job.id}/force-status`, { status: 'DISPUTED', reason: 'Customer called support' });
    assert(disp.status === 200 && db.repairJobs.find((j) => j.id === B.job.id)!.status === 'DISPUTED', 'admin opens a dispute');
    assert(auditOf('ADMIN_JOB_DISPUTE_OPENED').some((a) => a.resourceId === B.job.id && a.actorId === adminUser.id), 'dispute opening audited');
    const disputesList = await call('GET', '/admin/disputes', undefined, adminToken);
    assert(disputesList.status === 200 && disputesList.json.some((j: any) => j.id === B.job.id) && Number(disputesList.headers.get('x-total-count')) >= 1, 'disputes list');
    assert((await mut('POST', `/admin/disputes/${B.job.id}/resolve`, { decision: 'RELEASE_TECHNICIAN' })).status === 400, 'dispute resolution requires notes');
    assert((await mut('POST', `/admin/disputes/${B.job.id}/resolve`, { decision: 'BOGUS', resolutionNotes: 'nope' })).status === 400, 'dispute decision validated');
    assert((await mut('POST', `/admin/disputes/${A.job.id}/resolve`, { decision: 'REFUND_CUSTOMER', resolutionNotes: 'not disputed' })).status === 400, 'only DISPUTED jobs can be resolved');
    const resRepair = await mut('POST', `/admin/disputes/${B.job.id}/resolve`, { decision: 'RETURN_TO_REPAIR', resolutionNotes: 'Technician will redo the repair' });
    assert(resRepair.status === 200 && db.repairJobs.find((j) => j.id === B.job.id)!.status === 'REPAIR_IN_PROGRESS', 'dispute resolved: back to repair');
    await mut('POST', `/admin/jobs/${B.job.id}/force-status`, { status: 'DISPUTED', reason: 'Second dispute' });
    const resRel = await mut('POST', `/admin/disputes/${B.job.id}/resolve`, { decision: 'RELEASE_TECHNICIAN', resolutionNotes: 'Repair verified working' });
    assert(resRel.status === 200 && db.repairJobs.find((j) => j.id === B.job.id)!.status === 'COMPLETED' && db.payments.find((p) => p.id === B.payment.id)!.status === 'RELEASED_TO_TECHNICIAN', 'dispute resolved for the technician: job completed, escrow released');
    assert(db.technicianEarnings.find((e) => e.repairId === B.job.id)!.status === 'ELIGIBLE_FOR_PAYOUT', 'released earnings become eligible for payout');
    assert(auditOf('ADMIN_DISPUTE_RESOLVED').filter((a) => a.resourceId === B.job.id).length === 2 && db.notifications.some((n) => n.userId === 'usr_customer_1' && n.title === 'Dispute Resolved'), 'both resolutions audited; parties notified');
    await mut('POST', `/admin/jobs/${C.job.id}/force-status`, { status: 'DISPUTED', reason: 'Device damaged' });
    const resRef = await mut('POST', `/admin/disputes/${C.job.id}/resolve`, { decision: 'REFUND_CUSTOMER', resolutionNotes: 'Damage confirmed by photos' });
    assert(resRef.status === 200 && db.payments.find((p) => p.id === C.payment.id)!.status === 'REFUNDED' && db.repairJobs.find((j) => j.id === C.job.id)!.status === 'REFUNDED', 'dispute resolved for the customer: full refund');
    assert(db.refunds.some((r) => r.paymentId === C.payment.id && r.initiatedBy === adminUser.id && r.actorRole === 'admin'), 'refund record credits the admin as initiator');
    const cancel = await mut('POST', `/admin/jobs/${D.job.id}/force-status`, { status: 'CANCELLED', reason: 'Technician unavailable' });
    assert(cancel.status === 200 && cancel.json.refunded === true && db.repairJobs.find((j) => j.id === D.job.id)!.status === 'CANCELLED', 'force-cancel of a paid job refunds automatically');
    assert(auditOf('ADMIN_JOB_FORCE_CANCELLED').some((a) => a.resourceId === D.job.id && a.actorId === adminUser.id), 'force-cancel audited');

    const E = await makePaidJob(50000);
    assert((await call('POST', `/admin/payments/${E.payment.id}/refund`, { reason: 'partial', amountNaira: 10000 }, adminToken)).status === 403, 'refund needs the admin password');
    assert((await mut('POST', `/admin/payments/${E.payment.id}/refund`, { reason: 'ab', amountNaira: 10000 })).status === 400, 'refund needs a reason');
    assert((await mut('POST', `/admin/payments/${E.payment.id}/refund`, { reason: 'too much', amountNaira: 999999 })).status === 400, 'a refund above the paid amount is refused');
    assert((await mut('POST', `/admin/payments/${E.payment.id}/refund`, { reason: 'negative', amountNaira: -5 })).status === 400, 'negative refund refused');
    const partial = await mut('POST', `/admin/payments/${E.payment.id}/refund`, { reason: 'Goodwill after delay', amountNaira: 10000 });
    assert(partial.status === 200 && db.payments.find((p) => p.id === E.payment.id)!.status === 'PARTIALLY_REFUNDED' && partial.json.refund.amountNaira === 10000, 'partial refund via the admin endpoint');
    assert(auditOf('ADMIN_REFUND_ISSUED').some((a) => a.resourceId === E.payment.id && a.actorId === adminUser.id && (a.details as any).amountNaira === 10000), 'admin refund audited');
    assert((await call('GET', '/admin/refunds', undefined, adminToken)).json.length >= 3, 'refund ledger lists the refunds');
    const rec = await mut('POST', '/admin/payments/reconcile', {});
    assert(rec.status === 200 && typeof rec.json.checkedCount === 'number' && auditOf('ADMIN_PAYMENTS_RECONCILED').some((a) => a.actorId === adminUser.id), 'reconcile works and is audited');
    assert((await call('POST', '/payments/refund', { paymentId: E.payment.id, reason: 'legacy', amountNaira: 100 }, adminToken)).status === 403, 'the legacy admin refund endpoint now also demands the admin password');

    // ------------------------------------------------------------------ 10. payout approval flow
    console.log('\n10. Payout approval flow (PAYOUT_APPROVAL_REQUIRED=true)');
    process.env.PAYOUT_APPROVAL_REQUIRED = 'true';
    db.users.find((u) => u.id === 'usr_tech_1')!.emailVerified = true;
    const dest = { bankCode: '058', bankName: 'Guaranty Trust Bank', accountNumber: '0123456789', accountName: 'Emeka Okafor' };
    const eligible = db.technicianEarnings.filter((e) => e.technicianId === 'usr_tech_1' && e.status === 'ELIGIBLE_FOR_PAYOUT').reduce((n, e) => n + e.netEarningsNaira, 0);
    assert(eligible > 0, 'fixture: the technician has eligible earnings', String(eligible));
    const req1 = await PaymentService.requestPayout({ technicianId: 'usr_tech_1', amountNaira: 10000, destinationAccount: dest, actorId: 'usr_tech_1' });
    assert(req1.success && req1.payout!.status === 'PENDING' && !req1.payout!.providerReference, 'with approval on, a payout request is recorded as PENDING and nothing is sent to Paystack', JSON.stringify(req1));
    const req2 = await PaymentService.requestPayout({ technicianId: 'usr_tech_1', amountNaira: 10000, destinationAccount: dest, actorId: 'usr_tech_1' });
    assert(req2.success && req2.payout!.status === 'PENDING', 'a second request is also held');
    const overdraw = await PaymentService.requestPayout({ technicianId: 'usr_tech_1', amountNaira: eligible, destinationAccount: dest, actorId: 'usr_tech_1' });
    assert(overdraw.success === false, 'pending payouts reserve balance (no double-spend)');
    const pl = await call('GET', '/admin/payouts?status=PENDING', undefined, adminToken);
    assert(pl.status === 200 && pl.json.length === 2 && pl.json.every((p: any) => p.destinationAccount.accountNumber === '******6789'), 'payout ledger shows pending payouts with masked account numbers');
    assert((await call('POST', `/admin/payouts/${req1.payout!.id}/approve`, {}, adminToken)).status === 403, 'approve needs the admin password');
    const approve = await mut('POST', `/admin/payouts/${req1.payout!.id}/approve`, {});
    const approved = db.payouts.find((p) => p.id === req1.payout!.id)!;
    assert(approve.status === 200 && ['COMPLETED', 'PROCESSING'].includes(approved.status) && !!approved.providerReference && approved.reviewedBy === adminUser.id, 'approve sends the transfer and records the reviewer', `${approve.status} ${approved.status} ${JSON.stringify(approve.json)}`);
    assert(auditOf('ADMIN_PAYOUT_APPROVED').some((a) => a.resourceId === req1.payout!.id && a.actorId === adminUser.id), 'approval audited');
    assert((await mut('POST', `/admin/payouts/${req1.payout!.id}/approve`, {})).status === 400, 'a payout cannot be approved twice');
    assert((await mut('POST', `/admin/payouts/${req2.payout!.id}/reject`, {})).status === 400, 'reject needs a reason');
    const reject = await mut('POST', `/admin/payouts/${req2.payout!.id}/reject`, { reason: 'Account name mismatch' });
    assert(reject.status === 200 && db.payouts.find((p) => p.id === req2.payout!.id)!.status === 'REJECTED' && !db.payouts.find((p) => p.id === req2.payout!.id)!.providerReference, 'reject: nothing is sent, payout marked REJECTED');
    assert(auditOf('ADMIN_PAYOUT_REJECTED').some((a) => a.resourceId === req2.payout!.id && a.actorId === adminUser.id), 'rejection audited');
    assert(db.notifications.some((n) => n.userId === 'usr_tech_1' && n.title === 'Payout Not Approved'), 'technician notified of the rejection');
    assert((await mut('POST', '/admin/payouts/none/approve', {})).status === 404, 'payout 404');
    // approving a payout consumes whole earnings rows: top the technician up so the release/direct paths can be checked
    db.technicianEarnings.push({ id: 'earn_ap_topup', technicianId: 'usr_tech_1', repairId: 'rep_ap_topup', paymentId: 'pay_ap_topup', grossAmountNaira: 60000, platformFeeNaira: 6000, netEarningsNaira: 54000, commissionPercent: 10, status: 'ELIGIBLE_FOR_PAYOUT', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
    const after = await PaymentService.requestPayout({ technicianId: 'usr_tech_1', amountNaira: 10000, destinationAccount: dest, actorId: 'usr_tech_1' });
    assert(after.success, 'a rejected payout releases the reserved balance', JSON.stringify(after));
    delete process.env.PAYOUT_APPROVAL_REQUIRED;
    const direct = await PaymentService.requestPayout({ technicianId: 'usr_tech_1', amountNaira: 5000, destinationAccount: dest, actorId: 'usr_tech_1' });
    assert(direct.success && direct.payout!.status !== 'PENDING', 'with approval off (default) payouts go straight to the provider as before', String(direct.payout?.status));

    // ------------------------------------------------------------------ 11. announcements
    console.log('\n11. Announcements');
    assert((await mut('POST', '/admin/announcements', { title: 'x', message: 'short' })).status === 400, 'announcement title validated');
    assert((await mut('POST', '/admin/announcements', { title: 'Valid title', message: 'Valid message', audience: 'martians' })).status === 400, 'announcement audience validated');
    assert((await call('POST', '/admin/announcements', { title: 'Valid title', message: 'Valid message' }, adminToken)).status === 403, 'announcement needs the admin password');
    const techCount = db.users.filter((u) => u.role === 'technician' && u.status !== 'suspended').length;
    const ann = await mut('POST', '/admin/announcements', { title: 'Scheduled maintenance', message: 'Fixhub will be down tonight 11pm-12am WAT.', audience: 'technicians' });
    assert(ann.status === 201 && ann.json.recipients === techCount, 'announcement reaches every active technician');
    const annNotifs = db.notifications.filter((n) => n.announcementId === ann.json.announcementId);
    assert(annNotifs.length === techCount && annNotifs.every((n) => n.type === 'ANNOUNCEMENT' && db.users.find((u) => u.id === n.userId)!.role === 'technician'), 'announcement notifications are ANNOUNCEMENT-type and audience-scoped');
    const techNotifs = await call('GET', '/notifications', undefined, techToken);
    assert(techNotifs.status === 200 && techNotifs.json.some((n: any) => n.type === 'ANNOUNCEMENT'), 'the technician sees the announcement in their notifications');
    const annList = await call('GET', '/admin/announcements', undefined, adminToken);
    assert(annList.status === 200 && annList.json.length === 1 && annList.json[0].recipients === techCount && annList.json[0].sentBy === adminUser.id, 'announcement history');
    assert(auditOf('ADMIN_ANNOUNCEMENT_SENT').some((a) => a.actorId === adminUser.id), 'announcement audited');

    // ------------------------------------------------------------------ 12. audit log + exports
    console.log('\n12. Audit-log viewer and CSV exports');
    const al = await call('GET', '/admin/audit-logs?limit=5', undefined, adminToken);
    assert(al.status === 200 && al.json.length === 5 && Number(al.headers.get('x-total-count')) === db.auditLogs.length && al.json[0].timestamp >= al.json[4].timestamp, 'audit log: paginated, newest first, X-Total-Count');
    assert((await call('GET', '/admin/audit-logs?action=ADMIN_USER_SUSPENDED', undefined, adminToken)).json.every((a: any) => a.action === 'ADMIN_USER_SUSPENDED'), 'audit log: action filter');
    assert((await call('GET', `/admin/audit-logs?actorId=${adminUser.id}`, undefined, adminToken)).json.every((a: any) => a.actorId === adminUser.id), 'audit log: actor filter');
    assert((await call('GET', '/admin/audit-logs?resourceType=REVIEW', undefined, adminToken)).json.length >= 3, 'audit log: resource-type filter');
    assert((await call('GET', '/admin/audit-logs?q=Chargeback', undefined, adminToken)).json.length >= 1, 'audit log: free-text search inside details');
    assert(al.json[0].actorName !== undefined, 'audit log rows carry the actor name');
    assert((await call('GET', '/admin/audit-logs?from=bad', undefined, adminToken)).status === 400, 'audit log: bad date -> 400');
    for (const ledger of ['payments', 'refunds', 'payouts', 'earnings', 'jobs', 'audit-logs']) {
      const r = await call('GET', `/admin/export/${ledger}.csv`, undefined, adminToken);
      assert(r.status === 200 && (r.headers.get('content-type') || '').startsWith('text/csv') && /attachment; filename="fixhub-/.test(r.headers.get('content-disposition') || '') && r.text.split('\r\n').length >= 2, `export ${ledger}.csv: headers, BOM and rows`, `${r.status} ${r.headers.get('content-type')} ${r.headers.get('content-disposition')} ${JSON.stringify(r.text.slice(0,60))}`);
    }
    const rawBytes = new Uint8Array(await (await fetch(`${app.base}/admin/export/payments.csv`, { headers: { Authorization: `Bearer ${adminToken}`, 'X-Forwarded-For': '10.77.7.7' } })).arrayBuffer());
    assert(rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf, 'exports start with a UTF-8 BOM so Excel renders ₦ and accents');
    assert((await call('GET', '/admin/export/users.csv', undefined, adminToken)).status === 404, 'unknown ledger -> 404');
    const payCsv = await call('GET', '/admin/export/payments.csv?status=RELEASED_TO_TECHNICIAN', undefined, adminToken);
    assert(payCsv.text.split('\r\n').filter(Boolean).length === 1 + db.payments.filter((p) => p.status === 'RELEASED_TO_TECHNICIAN').length, 'export honours the status filter');
    assert(auditOf('ADMIN_LEDGER_EXPORTED').filter((a) => a.actorId === adminUser.id).length >= 6, 'every export is audited');
    const custRow: any = db.users.find((u) => u.id === 'usr_customer_1')!;
    const originalName = custRow.name;
    custRow.name = '=1+1';
    const jobsCsv = await call('GET', '/admin/export/jobs.csv', undefined, adminToken);
    custRow.name = originalName;
    assert(jobsCsv.text.includes("'=1+1") && !/(^|,)=1\+1/m.test(jobsCsv.text), 'exports neutralise spreadsheet formulas in user-controlled text');
    assert(!payCsv.text.includes('authorizationUrl') && !(await call('GET', '/admin/export/payouts.csv', undefined, adminToken)).text.includes('0123456789'), 'exports never contain gateway secrets or full account numbers');

    // ------------------------------------------------------------------ 13. sessions
    console.log('\n13. Session revocation');
    const logoutTok = (await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW })).json.token;
    assert((await call('GET', '/admin/me', undefined, logoutTok)).status === 200, 'second session works');
    assert((await call('POST', '/admin/auth/logout', {}, logoutTok)).status === 200 && (await call('GET', '/admin/me', undefined, logoutTok)).status === 401, 'logout revokes the token');
    const s1 = (await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW })).json.token;
    const s2 = (await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW })).json.token;
    const all = await call('POST', '/admin/auth/logout-all', { adminPassword: ADMIN_PW }, s1);
    assert(all.status === 200 && (await call('GET', '/admin/me', undefined, s1)).status === 401 && (await call('GET', '/admin/me', undefined, s2)).status === 401 && (await call('GET', '/admin/me', undefined, all.json.token)).status === 200, 'logout-all ends every session but hands back a fresh token');
    assert((await call('GET', '/admin/me', undefined, adminToken)).status === 401, 'the earlier main token is dead too');
    const t2 = (await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW })).json.token as string;
    const other = (await call('POST', '/admin/auth/login', { email: ADMIN2_EMAIL, password: ADMIN2_NEW_PW })).json.token as string;
    const kill = await call('POST', `/admin/users/${adminUser.id}/revoke-sessions`, { adminPassword: ADMIN2_NEW_PW }, other);
    assert(kill.status === 200 && (await call('GET', '/admin/me', undefined, t2)).status === 401, "one admin can revoke another admin's sessions");
    const t3 = (await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW })).json.token as string;

    // ------------------------------------------------------------------ 14. re-auth switch + lockout
    console.log('\n14. Re-auth switch and lockout through the confirm-password path');
    process.env.ADMIN_REQUIRE_REAUTH = 'false';
    const noPwNeeded = await call('POST', '/admin/users/usr_customer_2/suspend', { reason: 'no password required now' }, t3);
    process.env.ADMIN_REQUIRE_REAUTH = 'true';
    await call('POST', '/admin/users/usr_customer_2/reactivate', {}, t3);
    assert(noPwNeeded.status === 200, 'ADMIN_REQUIRE_REAUTH=false disables the password prompt');
    let lastRe: any = null;
    for (let i = 0; i < 5; i++) lastRe = await call('POST', '/admin/users/usr_customer_2/suspend', { reason: 'bad password attempts', adminPassword: 'wrong' + i }, t3);
    const lockedReauth = await call('POST', '/admin/users/usr_customer_2/suspend', { reason: 'bad password attempts', adminPassword: ADMIN_PW }, t3);
    assert(lastRe.status === 423 && lockedReauth.status === 423 && lockedReauth.json.code === 'ADMIN_LOCKED', 'wrong passwords in confirmation dialogs lock the admin (shared counter)');
    adminUser.adminLockedUntil = undefined;
    adminUser.adminFailedLogins = 0;
    assert(auditOf('ADMIN_REAUTH_FAILED').length >= 6, 'failed re-auth attempts are audited');

    // ------------------------------------------------------------------ 15. public surface hardening + no leaks
    console.log('\n15. Public surface hardening and no-leak sweep');
    const sw = await call('POST', '/auth/switch-role', { role: 'customer', password: ADMIN_PW }, t3);
    assert(sw.status === 403, 'an admin cannot switch roles through the public endpoint');
    const del = await call('DELETE', '/auth/account', { password: ADMIN_PW }, t3);
    assert(del.status >= 400 && db.users.some((u) => u.id === adminUser.id), 'an admin cannot delete their account through the public endpoint');
    assert(leaks.length === 0, 'no response anywhere in this suite contained a password hash', leaks.join(', '));

    // ------------------------------------------------------------------ 16. persistence across a restart
    console.log('\n16. Persistence across a simulated restart');
    await call('POST', '/admin/users/usr_customer_2/suspend', { reason: 'persist check', adminPassword: ADMIN_PW }, t3);
    const tRevoked = (await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW })).json.token as string;
    assert((await call('POST', '/admin/auth/logout', {}, tRevoked)).status === 200, 'fixture: a session is signed out just before the restart');
    const auditCountBefore = db.auditLogs.length;
    const payoutBefore = db.payouts.find((p) => p.id === req2.payout!.id)!.status;
    await db.simulateRestartForTests();
    const ngAfter = db.users.find((u) => u.id === 'usr_customer_2')!;
    assert(ngAfter.status === 'suspended' && ngAfter.suspendedBy === adminUser.id && ngAfter.suspendedReason === 'persist check', 'suspension survives a restart');
    assert(db.reviews.find((r) => r.id === 'rev_ap_1')?.hidden === true && db.reviews.find((r) => r.id === 'rev_ap_1')?.hiddenBy === adminUser.id, 'hidden review survives a restart');
    assert(!db.reviews.some((r) => r.id === 'rev_ap_2'), 'deleted review stays deleted after a restart');
    assert(db.auditLogs.length >= auditCountBefore && db.auditLogs.some((a) => a.action === 'ADMIN_USER_SUSPENDED' && (a.details as any)?.reason === 'persist check' && a.actorId === adminUser.id), 'audit log survives a restart (with actor)');
    assert(db.payouts.find((p) => p.id === req2.payout!.id)?.status === payoutBefore && db.payouts.find((p) => p.id === req1.payout!.id)?.reviewedBy === adminUser.id, 'payout review survives a restart');
    assert(db.riskEvents.find((r) => r.id === 'risk_ap_1')?.reviewed === true, 'risk-event review survives a restart');
    const persistedAdmin: any = db.users.find((u) => u.email === ADMIN_EMAIL);
    assert(persistedAdmin?.role === 'admin' && bcrypt.compareSync(ADMIN_PW, persistedAdmin.passwordHash), 'the admin account (bcrypt hash) survives a restart');
    const relog = await call('POST', '/admin/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PW });
    assert(relog.status === 200, 'the admin can sign in after a restart');
    assert((await call('GET', '/admin/me', undefined, tRevoked)).status === 401, 'sessions revoked before the restart stay revoked');
    assert((await call('GET', '/admin/me', undefined, relog.json.token)).status === 200, 'a fresh session works after the restart');
    assert(db.notifications.some((n) => n.type === 'ANNOUNCEMENT'), 'announcements persisted');
    assert((await call('GET', '/admin/announcements', undefined, relog.json.token)).json.length === 1, 'announcement history survives a restart');
  } catch (err: any) {
    console.error('  [FAIL] admin portal suite crashed:', err?.stack || err);
    failed++;
  } finally {
    if (savedReauth === undefined) delete process.env.ADMIN_REQUIRE_REAUTH;
    else process.env.ADMIN_REQUIRE_REAUTH = savedReauth;
    if (savedApproval === undefined) delete process.env.PAYOUT_APPROVAL_REQUIRED;
    else process.env.PAYOUT_APPROVAL_REQUIRED = savedApproval;
    await app.close();
  }

  console.log(`\n   ADMIN PORTAL TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  return { passed, failed };
}

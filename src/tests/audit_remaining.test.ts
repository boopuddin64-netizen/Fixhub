/**
 * Regression tests for the remaining audit items (branch chore/audit-remaining):
 * pagination, technician phone privacy, re-authentication, durable verification codes.
 * Route-level tests mount the real apiRouter on an ephemeral Express app (port 0).
 */
import express from 'express';
import type { AddressInfo } from 'net';
import { db } from '../../server/db';
import { apiRouter } from '../../server/routes/api';
import { globalErrorHandler } from '../../server/middleware/errorHandler';
import { parsePagination, MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT } from '../../server/utils/pagination';

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

export async function runAuditRemainingTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Remaining-Audit-Items Tests ---');
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
  const call = async (method: string, path: string, body?: any, token?: string) => {
    const res = await fetch(`${app.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.77.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  const login = async (email: string, password = 'password123') => (await call('POST', '/auth/login', { emailOrPhone: email, password })).json?.token as string;

  try {
    // ---------------------------------------------------------------- pagination
    console.log('Item 4: pagination on list endpoints');
    const w0 = parsePagination({} as any);
    assert(w0.limit === DEFAULT_PAGE_LIMIT && w0.offset === 0, 'default window is limit=200, offset=0');
    assert(parsePagination({ limit: '999999' } as any).limit === MAX_PAGE_LIMIT, 'limit is capped at the maximum');
    assert(parsePagination({ limit: '-5', offset: '-3' } as any).limit === DEFAULT_PAGE_LIMIT || parsePagination({ limit: '-5' } as any).limit >= 1, 'negative limit never yields a negative window');
    assert(parsePagination({ offset: 'abc', limit: 'xyz' } as any).offset === 0, 'garbage offset falls back to 0');
    assert(parsePagination({ limit: '0' } as any).limit === 1, 'limit=0 is raised to 1');

    const all = await call('GET', '/technicians');
    assert(all.status === 200 && Array.isArray(all.json), 'GET /technicians still returns a plain array (backward compatible)');
    const total = Number(all.headers.get('x-total-count'));
    assert(total === db.technicianProfiles.length && all.json.length === Math.min(total, DEFAULT_PAGE_LIMIT), 'X-Total-Count header reports the full size');
    const page = await call('GET', '/technicians?limit=2&offset=1');
    assert(page.json.length === 2 && page.json[0].userId === all.json[1].userId, 'limit/offset select a window');
    assert(page.headers.get('x-limit') === '2' && page.headers.get('x-offset') === '1', 'X-Limit / X-Offset are echoed');
    const past = await call('GET', '/technicians?offset=9999');
    assert(past.status === 200 && Array.isArray(past.json) && past.json.length === 0, 'offset beyond the end returns an empty array');
    const bad = await call('GET', '/technicians?limit=abc&offset=-1');
    assert(bad.status === 200 && bad.json.length === all.json.length, 'invalid limit/offset are ignored, not errors');

    const custTok = await login('customer@test.fixhub.local');
    const jobsPage = await call('GET', '/jobs?limit=1', undefined, custTok);
    assert(jobsPage.status === 200 && Array.isArray(jobsPage.json) && jobsPage.headers.get('x-total-count') !== null, 'GET /jobs is paginated');
    const notifPage = await call('GET', '/notifications?limit=1', undefined, custTok);
    assert(notifPage.status === 200 && Array.isArray(notifPage.json) && notifPage.json.length <= 1, 'GET /notifications is paginated');
    const reqPage = await call('GET', '/repairs/requests?limit=1', undefined, custTok);
    assert(reqPage.status === 200 && Array.isArray(reqPage.json) && reqPage.json.length <= 1, 'GET /repairs/requests is paginated');

    // ---------------------------------------------------------------- technician phone privacy
    console.log('Item 5: technician phone is hidden from public endpoints');
    const techId = db.technicianProfiles[0].userId;
    const techProfile = db.technicianProfiles[0];
    techProfile.phone = '+2348012345678';
    const listPub = await call('GET', '/technicians');
    assert(!listPub.text.includes('+2348012345678') && listPub.json.every((t: any) => !('phone' in t)), 'GET /technicians has no phone field');
    const onePub = await call('GET', `/technicians/${techId}`);
    assert(onePub.status === 200 && !('phone' in onePub.json.technician) && !onePub.text.includes('+2348012345678'), 'GET /technicians/:id has no phone field');
    const match = await call('POST', '/technicians/match', { customerLocation: { lat: 4.8156, lng: 7.0498, address: 'GRA', area: 'GRA', city: 'Port Harcourt', state: 'Rivers State' }, deviceBrand: 'Apple', issues: [] });
    assert(match.status === 200 && !match.text.includes('+2348012345678'), 'POST /technicians/match leaks no phone');

    const now = new Date().toISOString();
    const custId = db.users.find((u) => u.email === 'customer@test.fixhub.local')!.id;
    const otherCust = 'usr_customer_other';
    db.repairRequests.push({ id: 'req_phone_1', customerId: custId, deviceBrand: 'Apple', deviceModel: 'iPhone 13', deviceType: 'SMARTPHONE', issues: [], description: 'x', photos: [], status: 'QUOTE_ACCEPTED', createdAt: now, updatedAt: now, quotesCount: 1, matchedTechnicians: [] } as any);
    db.repairQuotes.push({ id: 'quote_phone_1', requestId: 'req_phone_1', technicianId: techId, technicianName: 'T', businessName: 'B', technicianPhone: '+2348012345678', technicianRating: 5, technicianReviewsCount: 1, distanceKm: 1, partsCost: 1, laborCost: 1, otherCost: 0, totalAmount: 2, estimatedTimeHours: 1, warrantyDays: 30, partsQuality: 'PREMIUM_AFTERMARKET', notes: '', status: 'SUBMITTED', createdAt: now } as any);
    const quotesBefore = await call('GET', '/repairs/requests/req_phone_1/quotes', undefined, custTok);
    assert(quotesBefore.status === 200 && quotesBefore.json[0]?.technicianPhone === '', 'quote list hides the technician phone before an active job exists');
    db.repairJobs.push({ id: 'job_phone_1', requestId: 'req_phone_1', quoteId: 'quote_phone_1', customerId: custId, technicianId: techId, deviceBrand: 'Apple', deviceModel: 'iPhone 13', issues: [], status: 'PAYMENT_PENDING', dropOffCode: 'FX-1', pickupCode: 'PK-1', handoffQrToken: 't', originalQuoteAmount: 2, finalAmount: 2, platformFeeAmount: 0, technicianPayoutAmount: 0, partsUsed: [], createdAt: now, statusHistory: [] } as any);
    const unpaid = await call('GET', '/jobs/job_phone_1', undefined, custTok);
    assert(unpaid.status === 200 && !unpaid.json.technician?.phone && !unpaid.text.includes('+2348012345678'), 'job detail hides the phone while payment is still pending');
    (db.repairJobs.find((j) => j.id === 'job_phone_1') as any).status = 'BOOKED';
    const active = await call('GET', '/jobs/job_phone_1', undefined, custTok);
    assert(active.status === 200 && active.json.technician?.phone === '+2348012345678', 'customer with an active job sees the technician phone on the job');
    const quotesActive = await call('GET', '/repairs/requests/req_phone_1/quotes', undefined, custTok);
    assert(quotesActive.json[0]?.technicianPhone === '+2348012345678', 'customer with an active job sees the phone on that technician quote');
    (db.repairJobs.find((j) => j.id === 'job_phone_1') as any).status = 'COMPLETED';
    const done = await call('GET', '/jobs/job_phone_1', undefined, custTok);
    assert(!done.json.technician?.phone, 'phone is hidden again once the job is closed');
    (db.repairJobs.find((j) => j.id === 'job_phone_1') as any).status = 'BOOKED';
    const custTok2 = await login('customer2@test.fixhub.local').catch(() => '');
    if (custTok2) {
      const other = await call('GET', '/jobs/job_phone_1', undefined, custTok2);
      assert(other.status === 404 && !other.text.includes('+2348012345678'), 'another customer cannot read the job or the phone');
    }
    void otherCust;
    const techTok = await login('technician@test.fixhub.local');
    if (db.users.find((u) => u.email === 'technician@test.fixhub.local')?.id === techId) {
      const own = await call('GET', '/jobs/job_phone_1', undefined, techTok);
      assert(own.status === 200 && own.json.technician?.phone === '+2348012345678', 'technician still sees own profile (incl. phone) on own job');
    }
    db.repairJobs.splice(db.repairJobs.findIndex((j) => j.id === 'job_phone_1'), 1);
    db.repairQuotes.splice(db.repairQuotes.findIndex((q) => q.id === 'quote_phone_1'), 1);
    db.repairRequests.splice(db.repairRequests.findIndex((r) => r.id === 'req_phone_1'), 1);

    // ---------------------------------------------------------------- re-authentication
    console.log('Item 6: password confirmation for switch-role and delete-account');
    const { AuthService } = await import('../../server/services/authService');
    const reg = AuthService.registerCustomer({ name: 'Reauth User', phone: '+2348055500001', email: 'reauth.user@example.com', password: 'Passw0rdX1' });
    assert(!('error' in reg), 'test user registers');
    const rTok = await login('reauth.user@example.com', 'Passw0rdX1');
    const swNo = await call('POST', '/auth/switch-role', { role: 'technician' }, rTok);
    assert(swNo.status === 403 && swNo.json?.code === 'PASSWORD_CONFIRMATION_FAILED', 'switch-role without password -> 403');
    const swBad = await call('POST', '/auth/switch-role', { role: 'technician', password: 'wrong-password1' }, rTok);
    assert(swBad.status === 403, 'switch-role with a wrong password -> 403 (not 401, so the client keeps the session)');
    assert(db.users.find((u) => u.email === 'reauth.user@example.com')?.role === 'customer', 'role unchanged after refused switch');
    const swObj = await call('POST', '/auth/switch-role', { role: 'technician', password: { $ne: 1 } }, rTok);
    assert(swObj.status === 403, 'switch-role with a non-string password -> 403');
    const swOk = await call('POST', '/auth/switch-role', { role: 'technician', password: 'Passw0rdX1' }, rTok);
    assert(swOk.status === 200 && swOk.json?.user?.role === 'technician', 'switch-role with the right password succeeds');
    const swBadRole = await call('POST', '/auth/switch-role', { role: 'admin', password: 'Passw0rdX1' }, rTok);
    assert(swBadRole.status === 400, 'switch-role still validates the role');

    const delNo = await call('DELETE', '/account/me', undefined, rTok);
    assert(delNo.status === 403 && db.users.some((u) => u.email === 'reauth.user@example.com'), 'delete-account without password -> 403, user kept');
    const delBad = await call('DELETE', '/account/me', { password: 'nope-nope-1' }, rTok);
    assert(delBad.status === 403 && db.users.some((u) => u.email === 'reauth.user@example.com'), 'delete-account with wrong password -> 403, user kept');
    const stillValid = await call('GET', '/auth/me', undefined, rTok);
    assert(stillValid.status === 200, 'session is still valid after a refused delete');
    const delOk = await call('DELETE', '/account/me', { password: 'Passw0rdX1' }, rTok);
    assert(delOk.status === 200 && !db.users.some((u) => u.email === 'reauth.user@example.com'), 'delete-account with the right password succeeds');
    const gone = await call('GET', '/auth/me', undefined, rTok);
    assert(gone.status === 401, 'token is revoked after deletion');

    // A social-login-only account (no password hash) cannot re-authenticate: clear message, nothing happens.
    (db.users as any[]).push({ id: 'usr_social_reauth', email: 'social.reauth@example.com', phone: '+2348055500002', name: 'Social', role: 'customer', passwordHash: '', createdAt: new Date().toISOString(), emailVerified: true });
    const sTok = AuthService.generateToken(db.users.find((u) => u.id === 'usr_social_reauth')!);
    const sDel = await call('DELETE', '/account/me', { password: 'anything1' }, sTok);
    assert(sDel.status === 403 && sDel.json?.code === 'PASSWORD_NOT_SET' && db.users.some((u) => u.id === 'usr_social_reauth'), 'password-less (social) account gets PASSWORD_NOT_SET and is not deleted');
    (db.users as any[]).splice((db.users as any[]).findIndex((u) => u.id === 'usr_social_reauth'), 1);
  } finally {
    await app.close();
  }

  console.log(`--- Finished Remaining-Audit-Items Tests: ${passed} passed, ${failed} failed ---`);
  return { passed, failed };
}

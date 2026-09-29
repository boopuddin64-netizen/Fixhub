/**
 * Regression tests for Postgres-backed durability (branch feat/postgres-persistence).
 *
 * "Restart" = db.simulateRestartForTests(): every in-memory collection, the token-revocation set and the OTP
 * map are thrown away and rebuilt from the database (which is left untouched) — the same code path a real
 * process restart takes via db.init().
 *
 * Runs on the pg-mem fallback by default. To run against a REAL PostgreSQL:
 *   FIXHUB_USE_POSTGRES=true DATABASE_URL=postgres://user:pw@host:5432/dbname npx tsx src/tests/postgres_persistence.test.ts
 */
import express from 'express';
import type { AddressInfo } from 'net';
import { db } from '../../server/db';
import { pgDb } from '../../server/db/pgClient';
import { apiRouter } from '../../server/routes/api';
import { AuthService } from '../../server/services/authService';
import { PaymentService } from '../../server/services/paymentService';
import { BankOtpService } from '../../server/services/bankOtpService';
import { NotificationService } from '../../server/services/notificationService';

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
  return { base: `http://127.0.0.1:${port}/api`, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

export async function runPostgresPersistenceTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running Postgres Persistence Regression Tests ---');
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
        'X-Forwarded-For': `10.77.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  };
  const rowCount = async (sql: string, params: any[] = []) => Number((await db.query(sql, params)).rows[0].n);
  const stamp = Date.now();
  const pw = 'Persist123';

  try {
    // ---------------------------------------------------------------- boot on an empty database
    console.log('1. Boot on an empty database');
    db.resetToSeed();
    if (!pgDb.isMemoryMode) {
      // real PostgreSQL: start from whatever the DB holds (fresh DB expected by the operator); no reset of rows here
    }
    const boot = await db.init();
    assert(typeof boot.hydrated === 'boolean', 'db.init() completes and reports whether it hydrated');
    assert(db.isPersistent, 'Write-through persistence is active after init()');
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = '__meta__'")) === 1, 'Bootstrap marker written exactly once');
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'deviceBrands'")) === 0, 'Reference catalog is not copied into entity_store (it is seeded from code)');
    const bootUsers = db.users.length;

    // ---------------------------------------------------------------- register -> data -> restart
    console.log('2. Register user, create data, restart');
    const custEmail = `persist.cust.${stamp}@example.com`;
    const techEmail = `persist.tech.${stamp}@example.com`;
    const reg = await call('POST', '/auth/register-customer', { name: 'Persist Customer', phone: `+23480${String(stamp).slice(-8)}`, email: custEmail, password: pw, address: '1 Test Rd', city: 'Lagos', state: 'Lagos' });
    assert(reg.status === 201 && !!reg.json?.token, 'Customer registration succeeds', reg.text.slice(0, 200));
    const regT = await call('POST', '/auth/register-technician', { name: 'Persist Tech', phone: `+23481${String(stamp).slice(-8)}`, email: techEmail, password: pw, businessName: 'Persist Repairs', shopAddress: '2 Shop St', city: 'Lagos', state: 'Lagos', supportedBrands: ['Apple'] });
    assert(regT.status === 201 && !!regT.json?.token, 'Technician registration succeeds', regT.text.slice(0, 200));
    const custId = reg.json.user.id as string;
    const techId = regT.json.user.id as string;
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'users' AND id = $1", [custId])) === 1, 'User row is in PostgreSQL before the response returned (durable ack)');
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'customerProfiles' AND id = $1", [custId])) === 1, 'Customer profile persisted');
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'technicianProfiles' AND id = $1", [techId])) === 1, 'Technician profile persisted');

    const custLogin = await call('POST', '/auth/login', { emailOrPhone: custEmail, password: pw });
    const custToken = custLogin.json?.token as string;
    const techLogin = await call('POST', '/auth/login', { emailOrPhone: techEmail, password: pw });
    const techToken = techLogin.json?.token as string;
    assert(!!custToken && !!techToken, 'Both users can log in before restart');

    const loc = { lat: 6.6, lng: 3.34, address: '1 Test Rd, Ikeja', city: 'Lagos', state: 'Lagos', source: 'GPS', area: 'Ikeja' };
    const rq = await call('POST', '/repairs/requests', { customerLocation: loc, deviceBrand: 'Apple', deviceModel: 'iPhone 13', issues: ['issue_screen_cracked'], description: `persist-request-${stamp}` }, custToken);
    assert(rq.status === 201 || rq.status === 200, 'Repair request created via API', rq.text.slice(0, 200));
    const requestId = rq.json?.id as string;

    // Quote + job created through the same services the API uses (technician eligibility rules are covered elsewhere)
    const now = new Date().toISOString();
    db.repairQuotes.push({
      id: `quote_persist_${stamp}`, requestId, technicianId: techId, technicianName: 'Persist Tech', businessName: 'Persist Repairs',
      technicianPhone: '+2348000000000', technicianRating: 5, technicianReviewsCount: 0, distanceKm: 3, partsCost: 30000, laborCost: 10000,
      otherCost: 0, totalAmount: 40000, estimatedTimeHours: 2, warrantyDays: 90, partsQuality: 'PREMIUM_AFTERMARKET', notes: 'persist', status: 'SUBMITTED', createdAt: now,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    } as any);
    const acc = await call('POST', '/quotes/accept', { requestId, quoteId: `quote_persist_${stamp}` }, custToken);
    assert(acc.status === 200 && !!acc.json?.job?.id, 'Quote accepted -> repair job created', acc.text.slice(0, 200));
    const jobId = acc.json?.job?.id as string;

    const msg = await call('POST', `/messages/${jobId}`, { text: `hello after restart ${stamp}` }, custToken);
    assert(msg.status === 201, 'Message posted', msg.text.slice(0, 200));

    // payment (sandbox): initialise. (Email verification is a separate flow; mark the account verified.)
    db.users.find((x) => x.id === custId)!.emailVerified = true;
    // payment (sandbox): initialise + verify -> SUCCESS + BOOKED + earnings HELD, all in one DB transaction
    const init = await PaymentService.initializePayment({ repairJobId: jobId, customerId: custId, paymentMethod: 'CARD', idempotencyKey: `idem_${stamp}` });
    assert(init.success === true, 'Payment initialised', JSON.stringify(init).slice(0, 200));
    const ver = init.success ? await PaymentService.verifyPayment({ reference: init.reference }) : ({ success: false } as any);
    assert(ver.success === true && ver.payment?.status === 'SUCCESS', 'Payment verified (sandbox)');
    await db.flush();

    const notif = NotificationService.send({ userId: custId, title: 'persist', message: 'persist notification', type: 'STATUS_CHANGE' });
    await db.flush();

    // OTP + revocation
    const otp = BankOtpService.issue(techId);
    assert(otp.ok === true, 'Bank OTP issued');
    const wrong = BankOtpService.verify(techId, otp.code === '000000' ? '111111' : '000000');
    assert(wrong.reason === 'INCORRECT' && wrong.attemptsLeft === 4, 'One wrong guess consumed');
    const out = await call('POST', '/auth/logout', {}, custToken);
    assert(out.status === 200, 'Logout succeeds');
    const revokedNow = await call('GET', '/auth/me', undefined, custToken);
    assert(revokedNow.status === 401, 'Revoked token is rejected before restart');
    await db.flush();
    assert((await rowCount('SELECT COUNT(*) AS n FROM revoked_tokens')) >= 1, 'Revocation row present in revoked_tokens');
    const digestLeak = await rowCount('SELECT COUNT(*) AS n FROM revoked_tokens WHERE token_hash = $1', [custToken]);
    assert(digestLeak === 0, 'Raw JWT is never stored (only its SHA-256)');
    const otpRow = (await db.query('SELECT code_hash FROM bank_otps WHERE technician_id = $1', [techId])).rows[0];
    assert(!!otpRow && otpRow.code_hash !== otp.code && String(otpRow.code_hash).length === 64, 'OTP stored only as an HMAC');

    // ---------------------------------------------------------------- restart
    console.log('3. Restart (memory dropped, state reloaded from PostgreSQL)');
    const before = { users: db.users.length, requests: db.repairRequests.length, jobs: db.repairJobs.length, msgs: db.messages.length };
    const restartInfo = await db.simulateRestartForTests();
    assert(restartInfo.hydrated === true, 'Second boot hydrates from the database (not seed data)');
    assert(db.users.length === before.users && db.users.length >= bootUsers + 2, 'User count identical after restart', `${db.users.length} vs ${before.users}`);
    assert(db.repairRequests.length === before.requests && db.repairJobs.length === before.jobs && db.messages.length === before.msgs, 'Requests / jobs / messages counts identical after restart');
    const u = db.users.find((x) => x.id === custId);
    assert(!!u && u.email === custEmail && !!(u as any).passwordHash, 'Registered customer (with password hash) exists after restart');
    assert(!!db.customerProfiles.find((p) => p.userId === custId) && !!db.technicianProfiles.find((p) => p.userId === techId), 'Customer and technician profiles exist after restart');
    assert(db.repairRequests.some((r) => r.id === requestId && r.description === `persist-request-${stamp}`), 'Repair request exists after restart');
    assert(db.repairQuotes.some((q) => q.id === `quote_persist_${stamp}` && q.status === 'ACCEPTED'), 'Quote (ACCEPTED) exists after restart');
    const job = db.repairJobs.find((j) => j.id === jobId);
    assert(!!job && job.status === 'BOOKED' && job.statusHistory.some((h) => h.status === 'PAYMENT_CONFIRMED'), 'Repair job exists after restart with status BOOKED and history');
    assert(db.messages.some((m) => m.repairId === jobId && m.text === `hello after restart ${stamp}`), 'Message exists after restart');
    assert(db.notifications.some((n) => n.id === notif.id), 'Notification exists after restart');
    assert(db.payments.some((p) => p.repairId === jobId && p.status === 'SUCCESS'), 'Confirmed payment exists after restart');
    assert(db.technicianEarnings.some((e) => e.repairId === jobId && e.status === 'HELD' && e.netEarningsNaira === ver.payment!.technicianPayoutNaira && e.netEarningsNaira > 0), 'Held earnings exist after restart');

    const relogin = await call('POST', '/auth/login', { emailOrPhone: custEmail, password: pw });
    assert(relogin.status === 200 && !!relogin.json?.token, 'Login with the registered password works after restart');
    const goodTok = relogin.json.token as string;
    const me = await call('GET', '/auth/me', undefined, goodTok);
    assert(me.status === 200, 'Fresh token is accepted after restart', String(me.status));
    const oldTok = await call('GET', '/auth/me', undefined, custToken);
    assert(oldTok.status === 401, 'Token revoked by logout STAYS revoked after restart');
    const jobsAfter = await call('GET', '/jobs', undefined, goodTok);
    assert(jobsAfter.status === 200 && JSON.stringify(jobsAfter.json).includes(jobId), 'Customer sees their job via the API after restart');
    const msgsAfter = await call('GET', `/messages/${jobId}`, undefined, goodTok);
    assert(msgsAfter.status === 200 && JSON.stringify(msgsAfter.json).includes(`hello after restart ${stamp}`), 'Conversation readable via the API after restart');

    // OTP survives restart: attempt counter is NOT reset by restarting
    const st = BankOtpService._peek(techId);
    assert(!!st && st.attempts === 1, 'OTP wrong-attempt counter survived the restart (cannot be reset by restarting)');
    assert(BankOtpService.verify(techId, otp.code).ok === true, 'Correct OTP still verifies after restart');
    assert(BankOtpService.isUnlocked(techId) === true, 'OTP unlock window state works after restart');
    await db.flush();

    // ---------------------------------------------------------------- deletes are durable
    console.log('4. Account deletion and revocation are durable');
    const del = await call('DELETE', '/account/me', undefined, goodTok);
    assert(del.status === 200, 'Account deletion succeeds');
    await db.simulateRestartForTests();
    assert(!db.users.some((x) => x.id === custId), 'Deleted user is still gone after restart');
    assert(!db.customerProfiles.some((x) => x.userId === custId), 'Deleted customer profile is still gone after restart');
    assert((await call('GET', '/auth/me', undefined, goodTok)).status === 401, 'Token of the deleted account stays invalid after restart');

    // ---------------------------------------------------------------- atomicity
    console.log('5. Transactions: all-or-nothing');
    const beforeUsers = db.users.length;
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        db.users.push({ id: `usr_rollback_${stamp}`, email: `rb${stamp}@example.com`, phone: '+2348011111111', name: 'Rollback', role: 'customer', createdAt: new Date().toISOString(), passwordHash: 'x' } as any);
        await tx.query('SELECT 1');
        throw new Error('boom');
      });
    } catch { threw = true; }
    assert(threw && db.users.length === beforeUsers, 'Failed transaction restores in-memory state');
    await db.flush();
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'users' AND id = $1", [`usr_rollback_${stamp}`])) === 0, 'Failed transaction persists nothing');

    const persistedBefore = await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'payments'");
    const otherJob = db.repairJobs.find((j) => j.id === jobId)!;
    let dupErr = '';
    try {
      await db.query(
        `INSERT INTO payments (id, repair_id, customer_id, amount_naira, status, payment_method, transaction_ref)
         VALUES ($1, $2, $3, 1, 'SUCCESS', 'CARD', $4)`,
        [`pay_dup_${stamp}`, otherJob.id, otherJob.customerId, `DUP-${stamp}`]
      );
    } catch (e: any) { dupErr = String(e?.message || e); }
    // the first confirmed payment row is written transactionally on verify (relational table); a second SUCCESS row for the same job must be refused by the DB
    await db.query(
      `INSERT INTO payments (id, repair_id, customer_id, amount_naira, status, payment_method, transaction_ref) VALUES ($1, $2, $3, 1, 'SUCCESS', 'CARD', $4) ON CONFLICT DO NOTHING`,
      [`pay_dup0_${stamp}`, otherJob.id, otherJob.customerId, `DUP0-${stamp}`]
    ).catch(() => {});
    let dupErr2 = '';
    try {
      await db.query(
        `INSERT INTO payments (id, repair_id, customer_id, amount_naira, status, payment_method, transaction_ref) VALUES ($1, $2, $3, 1, 'SUCCESS', 'CARD', $4)`,
        [`pay_dup2_${stamp}`, otherJob.id, otherJob.customerId, `DUP2-${stamp}`]
      );
    } catch (e: any) { dupErr2 = String(e?.message || e); }
    assert(/unique|duplicate/i.test(dupErr || dupErr2), 'Database refuses a second confirmed payment for the same repair job (cross-process duplicate-charge guard)', dupErr || dupErr2 || 'no error');
    assert(persistedBefore >= 1, 'payments collection is persisted');

    // ---------------------------------------------------------------- write failure => no false success
    console.log('6. A write that cannot be made durable is not acknowledged');
    const realTx = pgDb.transaction.bind(pgDb);
    let failNext = true;
    (pgDb as any).transaction = async (...args: any[]) => {
      if (failNext) throw new Error('simulated database outage');
      return (realTx as any)(...args);
    };
    const failEmail = `persist.fail.${stamp}@example.com`;
    let failed500 = false;
    try {
      const r = await call('POST', '/auth/register-customer', { name: 'Fail Case', phone: `+23482${String(stamp).slice(-8)}`, email: failEmail, password: pw });
      failed500 = r.status === 500;
    } finally {
      failNext = false;
    }
    assert(failed500, 'Registration during a DB outage returns 500 instead of a false success');
    await db.flush(); // outage over: the retained change is retried by the next flush
    (pgDb as any).transaction = realTx;
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'users' AND doc->>'email' = $1", [failEmail])) === 1, 'Pending change is retried and committed once the database is back');

    // ---------------------------------------------------------------- idempotent schema
    console.log('7. Schema is idempotent');
    await pgDb.executeSchema();
    await pgDb.executeSchema();
    assert((await rowCount("SELECT COUNT(*) AS n FROM entity_store WHERE collection = 'users' AND id = $1", [techId])) === 1, 'Re-running the schema/migration keeps existing data');
  } catch (e: any) {
    console.error('  [FAIL] Unexpected error in persistence tests:', e?.stack || e);
    failed++;
  } finally {
    await app.close();
  }

  console.log(`--- Finished Postgres Persistence Tests: ${passed} passed, ${failed} failed ---`);
  return { passed, failed };
}

const isDirectRun = typeof process !== 'undefined' && process.argv[1] && /postgres_persistence\.test\.(ts|js)$/.test(process.argv[1]);
if (isDirectRun) {
  runPostgresPersistenceTests()
    .then(async (r) => {
      await db.shutdown();
      await pgDb.pool.end().catch(() => {});
      process.exit(r.failed > 0 ? 1 : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

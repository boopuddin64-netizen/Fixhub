/**
 * UX-upgrade tests (branch feat/admin-portal-and-ux): NGN / date / phone formatting, the shared repair-timeline model,
 * repairs-list classification, and server-side phone validation + normalisation on registration and login.
 */
import express from 'express';
import type { AddressInfo } from 'net';
import { db } from '../../server/db';
import { apiRouter } from '../../server/routes/api';
import { globalErrorHandler } from '../../server/middleware/errorHandler';
import { formatNaira, formatCount, normalizeNgPhone, isValidNgPhone, formatNgPhone, phonesMatch, phoneFieldError, timeAgo, lagosDayKey, formatDate, formatDateTime } from '../utils/format';
import { computeTimeline, isHistoryStatus, TIMELINE_STEPS } from '../utils/repairTimeline';

let ipCounter = 1;

export async function runUxUpgradeTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- Running UX Upgrade Tests ---');
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

  console.log('1. NGN formatting is locale independent');
  assert(formatNaira(1234567) === '₦1,234,567' && formatNaira(0) === '₦0' && formatNaira(999) === '₦999', 'integers are grouped with commas');
  assert(formatNaira(1234.5) === '₦1,234.50' && formatNaira(10.005, { decimals: 2 }).startsWith('₦10.0'), 'fractions get two decimals');
  assert(formatNaira(undefined) === '₦0' && formatNaira('abc') === '₦0' && formatNaira(NaN) === '₦0' && formatNaira(null) === '₦0', 'garbage input never renders "NaN"');
  assert(formatNaira(-2500) === '-₦2,500' && formatNaira(-0.001, { decimals: 0 }) === '₦0', 'negatives keep the sign in front of the symbol; -0 is just ₦0');
  assert(formatNaira('45000') === '₦45,000', 'numeric strings are accepted');
  assert(formatCount(1234567) === '1,234,567' && formatCount(undefined) === '0' && formatCount(-1500) === '-1,500', 'formatCount');
  const realToLocale = Number.prototype.toLocaleString;
  (Number.prototype as any).toLocaleString = () => '1.234,5'; // a German-style locale must not leak into prices
  assert(formatNaira(1234567) === '₦1,234,567', 'output does not depend on Number#toLocaleString');
  Number.prototype.toLocaleString = realToLocale;

  console.log('\n2. Nigerian phone numbers');
  for (const ok of ['0803 123 4567', '08031234567', '+2348031234567', '+234 803 123 4567', '2348031234567', '803-123-4567', '+234(0)803 123 4567'.replace('(0)', '0'), '0902 555 0101', '07012345678']) {
    assert(normalizeNgPhone(ok) === `+234${ok.replace(/\D/g, '').slice(-10)}`, `accepts and normalises "${ok}"`);
  }
  for (const bad of ['', '12345', '0803123456', '080312345678', '+1 415 555 2671', 'not a number', '0603 123 4567', '+234 803 123 45 6x', undefined as any, 8031234567 as any]) {
    assert(!isValidNgPhone(bad), `rejects ${JSON.stringify(bad)}`);
  }
  assert(formatNgPhone('08031234567') === '+234 803 123 4567' && formatNgPhone('junk') === 'junk' && formatNgPhone(5 as any) === '', 'formatNgPhone');
  assert(phonesMatch('0803 123 4567', '+234 803 123 4567') && phonesMatch('+2348031234567', '2348031234567') && !phonesMatch('0803 123 4567', '0803 123 4568') && !phonesMatch('', '') && !phonesMatch(undefined, undefined), 'phonesMatch treats every spelling of one number as equal');
  assert(phoneFieldError('') !== null && phoneFieldError('123') !== null && phoneFieldError('08031234567') === null, 'phoneFieldError messages');

  console.log('\n3. Dates and relative times (Africa/Lagos, UTC+1)');
  assert(lagosDayKey('2026-09-30T23:30:00Z') === '2026-10-01' && lagosDayKey('2026-09-30T22:59:00Z') === '2026-09-30', 'Lagos day boundary is 23:00 UTC');
  assert(formatDate('2026-09-30T12:00:00Z') === '30 Sep 2026' && formatDateTime('2026-09-30T13:05:00Z') === '30 Sep 2026, 14:05', 'formatDate / formatDateTime are WAT and locale independent');
  assert(formatDate('nonsense') === '' && formatDateTime('nonsense') === '', 'invalid dates render as empty text');
  const now = Date.parse('2026-09-30T12:00:00Z');
  assert(timeAgo(now - 20_000, now) === 'Just now' && timeAgo(now - 5 * 60_000, now) === '5 min ago' && timeAgo(now - 3 * 3600_000, now) === '3 h ago' && timeAgo(now - 30 * 3600_000, now) === 'Yesterday' && timeAgo(now - 3 * 86400_000, now) === '3 days ago' && timeAgo(now - 30 * 86400_000, now) === '31 Aug 2026', 'timeAgo buckets');
  assert(timeAgo('garbage', now) === '' && timeAgo(now + 60_000, now) === 'Just now', 'timeAgo is safe for garbage and future timestamps');

  console.log('\n4. Shared repair timeline');
  const t0 = computeTimeline('PAYMENT_PENDING');
  assert(t0.steps.length === TIMELINE_STEPS.length && t0.completed === 0 && t0.steps[0].state === 'current' && t0.steps.slice(1).every((s) => s.state === 'upcoming'), 'a new booking: first step is current, rest upcoming');
  const t1 = computeTimeline('DIAGNOSING');
  assert(t1.steps.map((s) => s.state).join() === 'done,done,done,current,upcoming,upcoming,upcoming' && t1.summary === '3 of 7 steps done', 'mid-repair progress');
  const t2 = computeTimeline('REPAIR_IN_PROGRESS');
  assert(t2.completed === 4 && t2.steps[4].state === 'current', 'repair in progress');
  const t3 = computeTimeline('COMPLETED');
  assert(t3.completed === 7 && t3.percent === 100 && t3.summary === 'Repair complete' && !t3.steps.some((s) => s.state === 'current'), 'completed: everything done, nothing "current"');
  const hist = [
    { status: 'PAYMENT_PENDING', timestamp: '2026-09-01T09:00:00Z' }, { status: 'BOOKED', timestamp: '2026-09-01T10:00:00Z' },
    { status: 'DEVICE_DROPPED_OFF', timestamp: '2026-09-02T09:00:00Z' }, { status: 'DEVICE_RECEIVED', timestamp: '2026-09-02T09:30:00Z' }, { status: 'DIAGNOSING', timestamp: '2026-09-02T10:00:00Z' },
  ];
  const th = computeTimeline('DIAGNOSING', hist);
  assert(th.steps[0].at === '2026-09-01T10:00:00Z' && th.steps[1].at === '2026-09-02T09:00:00Z' && th.steps[3].at === undefined, 'steps show when they were reached (from statusHistory), unreached steps have no time');
  const td = computeTimeline('DISPUTED', hist);
  assert(td.terminal === 'DISPUTED' && td.completed === 3 && td.steps.every((s) => s.state !== 'current') && td.summary === 'Dispute under review', 'DISPUTED keeps the progress reached so far and shows no "current" step');
  assert(computeTimeline('CANCELLED', [{ status: 'BOOKED', timestamp: 'x' }]).terminal === 'CANCELLED' && computeTimeline('CANCELLED').completed === 0, 'CANCELLED before any progress');
  assert(computeTimeline('REFUNDED', hist).terminal === 'REFUNDED' && computeTimeline('REFUNDED', hist).summary === 'Payment refunded', 'REFUNDED');
  assert(computeTimeline('WHATEVER', undefined as any).steps.length === 7, 'unknown status / missing history does not throw');
  assert(isHistoryStatus('COMPLETED') && isHistoryStatus('CANCELLED') && isHistoryStatus('REFUNDED') && !isHistoryStatus('DISPUTED') && !isHistoryStatus('BOOKED'), 'REFUNDED jobs belong to history, DISPUTED stay active');

  console.log('\n5. Registration: server-side phone validation and normalisation');
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(globalErrorHandler);
  const server = await new Promise<import('http').Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const call = async (path: string, body: any) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.55.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}` }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  try {
    db.resetToSeed();
    const bad = await call('/auth/register-customer', { name: 'Bad Phone', phone: '12345', email: 'bad.phone@example.com', password: 'Passw0rd1', city: 'Lagos', state: 'Lagos' });
    assert(bad.status === 400 && bad.json.code === 'INVALID_PHONE' && bad.json.field === 'phone' && /Nigerian mobile number/.test(bad.json.error), 'customer registration rejects a bad phone with a helpful message', JSON.stringify(bad.json));
    assert(!db.users.some((u) => u.email === 'bad.phone@example.com'), 'no account is created for the rejected registration');
    const badTech = await call('/auth/register-technician', { name: 'Bad Tech', phone: 'abc', email: 'bad.tech@example.com', businessName: 'X', shopAddress: 'Somewhere', password: 'Passw0rd1' });
    assert(badTech.status === 400 && badTech.json.code === 'INVALID_PHONE', 'technician registration rejects a bad phone too');
    const good = await call('/auth/register-customer', { name: 'Ada Obi', phone: '0803 555 0199', email: 'ada.obi@example.com', password: 'Passw0rd1', city: 'Lagos', state: 'Lagos' });
    assert(good.status === 201, 'a Nigerian number typed the local way is accepted', JSON.stringify(good.json));
    assert(db.users.find((u) => u.email === 'ada.obi@example.com')?.phone === '+2348035550199', 'the phone is stored in E.164 form');
    const dup = await call('/auth/register-customer', { name: 'Ada Two', phone: '+234 803 555 0199', email: 'ada.two@example.com', password: 'Passw0rd1', city: 'Lagos', state: 'Lagos' });
    assert(dup.status === 400, 'the same number in another spelling is detected as a duplicate account');
    const loginByPhone = await call('/auth/login', { emailOrPhone: '08035550199', password: 'Passw0rd1' });
    assert(loginByPhone.status === 200 && !!loginByPhone.json.token, 'login works with any spelling of the registered phone number');
    const seededByPhone = await call('/auth/login', { emailOrPhone: '08031234567', password: 'password123' });
    assert(seededByPhone.status === 200, 'seeded accounts stored as "+234 803 123 4567" still log in with the local spelling');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n   UX UPGRADE TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  return { passed, failed };
}

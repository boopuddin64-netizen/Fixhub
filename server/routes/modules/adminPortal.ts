/**
 * ADMIN PORTAL API  (everything under /api/admin, plus the legacy /admin/disputes paths)
 *
 * Security model
 *  - POST /admin/auth/login is the ONLY way an admin signs in (the public /auth/login treats admin accounts as "wrong
 *    credentials"). Own rate limit (failed attempts only) + per-account lockout, 8-hour revocable sessions.
 *  - Every other route sits behind: rate limit -> requireAuth (401) -> role must be `admin` (403, role is read from the
 *    database, not from the token) -> "must change password" gate.
 *  - Destructive actions additionally demand the admin's password again (`adminPassword` in the JSON body) unless
 *    ADMIN_REQUIRE_REAUTH=false. Wrong password -> 403 ADMIN_REAUTH_FAILED (shares the account lockout).
 *  - Every mutation writes an audit log entry (actor id, role, IP, before/after or reason). Sensitive reads
 *    (chat messages, ledger exports) are audited as well.
 *  - Responses go through a scrubber that removes password hashes, codes/secrets, handoff codes and masks bank account
 *    numbers, no matter which handler produced them.
 *  - Lists are paginated with ?limit=&offset= and X-Total-Count / X-Limit / X-Offset (same convention as the rest of the API).
 */
import { NextFunction, Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { AuditService } from '../../services/auditService';
import { AdminAuthService, adminReauthRequired } from '../../services/adminAuthService';
import { NotificationService } from '../../services/notificationService';
import { PaymentService } from '../../services/paymentService';
import { RepairWorkflowService } from '../../services/repairWorkflowService';
import { recomputeTechnicianRating } from '../../services/reviewService';
import { adminApiRateLimiter, adminBulkRateLimiter, adminLoginRateLimiter } from '../../middleware/rateLimiters';
import { paginate } from '../../utils/pagination';
import { toCsv, CsvColumn } from '../../utils/csv';
import { sanitizeString } from '../../utils/validation';
import { formatNaira, lagosDayKey } from '../../../src/utils/format';
import { ADMIN_PASSWORD_POLICY_MESSAGE } from '../../../src/utils/adminPasswordPolicy';
import type { PaymentTransaction, RepairJob, TechnicianProfile, User } from '../../../src/types/index';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole } from './shared';

/* ------------------------------------------------------------------ helpers */

/** Keys that must never leave the server, whatever the handler returns. */
const FORBIDDEN_KEYS = new Set([
  'passwordHash', 'password_hash', 'password', 'adminPassword', 'currentPassword', 'newPassword',
  'codeHash', 'codeKey', 'bankChangeVerification', 'sessionVersion', 'adminFailedLogins', 'adminLockedUntil',
  'dropOffCode', 'pickupCode', 'handoffQrToken', 'accessCode', 'authorizationUrl', 'idempotencyKey',
]);

export function maskAccountNumber(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const digits = v.replace(/\s+/g, '');
  return digits.length > 4 ? `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : digits;
}

/** Deep copy without secrets; bank account numbers are masked to their last 4 digits. */
export function scrubForAdmin<T>(value: T, depth = 0): T {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubForAdmin(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    if (k === 'accountNumber') out[k] = maskAccountNumber(v);
    else out[k] = scrubForAdmin(v, depth + 1);
  }
  return out as T;
}

const pageOpts = { defaultLimit: 25, maxLimit: 200 };

function audit(req: AuthenticatedRequest, action: string, resourceType: string, resourceId: string, details: Record<string, unknown> = {}) {
  return AuditService.log({
    actorId: req.user!.id,
    actorRole: 'admin',
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: req.ip,
  });
}

/** Password re-entry for destructive actions. Sends the error response itself and returns false when it fails. */
function reauth(req: AuthenticatedRequest, res: Response): boolean {
  if (!adminReauthRequired()) return true;
  const result = AdminAuthService.confirmPassword(req.user!.id, req.body?.adminPassword);
  if (result.ok) return true;
  audit(req, 'ADMIN_REAUTH_FAILED', 'USER', req.user!.id, { path: req.path, reason: result.reason });
  if (result.reason === 'LOCKED') {
    res.status(423).json({ error: 'Too many wrong passwords. Your admin account is locked for 15 minutes.', code: 'ADMIN_LOCKED', retryAfterSec: result.retryAfterSec });
  } else {
    res.status(403).json({ error: 'Password confirmation failed. Enter your admin password to continue.', code: 'ADMIN_REAUTH_FAILED' });
  }
  return false;
}

function reasonOf(req: AuthenticatedRequest, res: Response, opts: { required?: boolean; field?: string } = {}): string | null | undefined {
  const raw = req.body?.[opts.field || 'reason'];
  const text = sanitizeString(raw, 500);
  if (opts.required !== false && text.length < 3) {
    res.status(400).json({ error: 'A reason of at least 3 characters is required.', code: 'REASON_REQUIRED' });
    return undefined;
  }
  return text || null;
}

function parseDateParam(res: Response, raw: unknown, name: string): number | null | undefined {
  if (raw === undefined || raw === '') return null;
  const t = Date.parse(String(raw));
  if (!Number.isFinite(t)) {
    res.status(400).json({ error: `Invalid "${name}" date. Use an ISO date such as 2026-09-30.` });
    return undefined;
  }
  return t;
}

const qStr = (v: unknown, max = 100): string => (typeof v === 'string' ? v.trim().slice(0, max) : Array.isArray(v) && typeof v[0] === 'string' ? v[0].trim().slice(0, max) : '');
const qList = (v: unknown): string[] => qStr(v, 300).split(',').map((s) => s.trim()).filter(Boolean);
const includesCI = (hay: unknown, needle: string) => typeof hay === 'string' && hay.toLowerCase().includes(needle);

function sortItems<T>(items: T[], req: AuthenticatedRequest, getters: Record<string, (x: T) => string | number>, dflt: string): T[] {
  const key = qStr(req.query.sort, 30);
  const getter = getters[key] || getters[dflt];
  const dir = qStr(req.query.order, 4).toLowerCase() === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = getter(a);
    const y = getter(b);
    if (x === y) return 0;
    return (x < y ? -1 : 1) * dir;
  });
}

const userById = (id: string | undefined) => (id ? db.users.find((u) => u.id === id) : undefined);
const jobAmount = (j: RepairJob) => j.finalAmount || j.originalQuoteAmount || j.totalAmountNaira || 0;

type KycState = 'VERIFIED' | 'REJECTED' | 'PENDING';
export function kycState(t: TechnicianProfile): KycState {
  if (t.isVerified) return 'VERIFIED';
  if (t.verificationStatus?.kycReview?.status === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

function userRow(u: User & { passwordHash: string }, techs?: Map<string, TechnicianProfile>) {
  const tech = techs ? techs.get(u.id) : db.technicianProfiles.find((t) => t.userId === u.id);
  const base: Record<string, unknown> = {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status || 'active',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
    emailVerified: Boolean(u.emailVerified),
    phoneVerified: Boolean(u.phoneVerified),
    authProvider: u.authProvider || 'local',
    hasPassword: Boolean(u.passwordHash),
    suspendedAt: u.suspendedAt || null,
    suspendedReason: u.suspendedReason || null,
    suspendedBy: u.suspendedBy || null,
  };
  if (u.role === 'technician' && tech) {
    base.technician = {
      businessName: tech.businessName,
      city: tech.shopLocation?.city || tech.city || '',
      state: tech.shopLocation?.state || tech.state || '',
      rating: tech.rating,
      reviewCount: tech.reviewCount,
      completedJobs: tech.completedJobs,
      trustLevel: tech.trustLevel,
      availability: tech.availability,
      isVerified: Boolean(tech.isVerified),
      kycStatus: kycState(tech),
      verificationStatus: tech.verificationStatus,
      bankConfigured: Boolean(tech.bankDetails?.accountNumber),
    };
  }
  return base;
}

/* ------------------------------------------------------------------ auth (no admin guard: this IS the sign-in) */

apiRouter.post('/admin/auth/login', adminLoginRateLimiter, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const result = AdminAuthService.login(req.body?.email, req.body?.password);
  if (!result.ok) {
    // Only failures against a REAL admin account are audited (an unauthenticated flood must not be able to bloat the log).
    if (result.adminId) {
      AuditService.log({
        actorId: result.adminId,
        actorRole: 'admin',
        action: result.code === 'ADMIN_LOCKED' ? 'ADMIN_LOGIN_LOCKED' : 'ADMIN_LOGIN_FAILED',
        resourceType: 'USER',
        resourceId: result.adminId,
        details: { code: result.code || 'INVALID_CREDENTIALS' },
        ipAddress: req.ip,
      });
    }
    // Locked accounts answer exactly like wrong credentials: the response must not reveal that an admin exists.
    return res.status(401).json({ error: result.error });
  }
  AuditService.log({ actorId: result.user!.id, actorRole: 'admin', action: 'ADMIN_LOGIN', resourceType: 'USER', resourceId: result.user!.id, details: {}, ipAddress: req.ip });
  return res.json({ token: result.token, user: result.user, mustChangePassword: result.mustChangePassword });
});

/* ------------------------------------------------------------------ guard for everything else under /admin */

apiRouter.use(
  '/admin',
  adminApiRateLimiter,
  requireAuth,
  requireRole(['admin']),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    const originalJson = res.json.bind(res);
    (res as any).json = (body: unknown) => originalJson(scrubForAdmin(body));

    const me = db.users.find((u) => u.id === req.user!.id);
    const gated = me?.mustChangePassword && !/^\/(me|auth\/(change-password|logout))$/.test(req.path);
    if (gated) {
      return res.status(403).json({ error: 'You must choose a new password before using the admin portal.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next();
  }
);

apiRouter.get('/admin/me', (req: AuthenticatedRequest, res: Response) => {
  const me = db.users.find((u) => u.id === req.user!.id)!;
  return res.json({
    user: AuthService.toPublicUser(me),
    config: adminConfig(),
  });
});

function adminConfig() {
  return {
    reauthRequired: adminReauthRequired(),
    payoutApprovalRequired: PaymentService.payoutApprovalRequired(),
    commissionPercent: Math.round(PaymentService.COMMISSION_RATE * 10000) / 100,
    environment: process.env.NODE_ENV || 'development',
    paymentMode: process.env.NODE_ENV === 'production' ? 'live' : (process.env.PAYMENT_MODE || 'sandbox'),
  };
}

apiRouter.get('/admin/config', (_req: AuthenticatedRequest, res: Response) => res.json(adminConfig()));

apiRouter.post('/admin/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) AuthService.revokeToken(header.substring(7));
  audit(req, 'ADMIN_LOGOUT', 'USER', req.user!.id);
  return res.json({ success: true });
});

apiRouter.post('/admin/auth/change-password', (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  const check = AdminAuthService.confirmPassword(req.user!.id, currentPassword);
  if (!check.ok) {
    return res.status(check.reason === 'LOCKED' ? 423 : 403).json({ error: 'The current password is incorrect.', code: 'ADMIN_REAUTH_FAILED' });
  }
  const result = AuthService.changePassword(req.user!.id, currentPassword, newPassword.slice(0, 200));
  if (!result.success) {
    return res.status(400).json({ error: result.error || ADMIN_PASSWORD_POLICY_MESSAGE, code: 'WEAK_PASSWORD' });
  }
  audit(req, 'ADMIN_PASSWORD_CHANGED', 'USER', req.user!.id);
  const session = AuthService.getUserSession(req.user!.id);
  return res.json({ success: true, token: result.token, user: session?.user });
});

/** "Sign out everywhere": every JWT of this admin (including the current one) stops working; a fresh token is returned. */
apiRouter.post('/admin/auth/logout-all', (req: AuthenticatedRequest, res: Response) => {
  AdminAuthService.revokeAllSessions(req.user!.id);
  audit(req, 'ADMIN_SESSIONS_REVOKED', 'USER', req.user!.id, { scope: 'self' });
  const me = db.users.find((u) => u.id === req.user!.id)!;
  return res.json({ success: true, token: AuthService.generateToken(me) });
});

/* ------------------------------------------------------------------ dashboard */

const PAID_STATUSES = new Set(['SUCCESS', 'ESCROW_HELD', 'RELEASED_TO_TECHNICIAN', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED']);
const HELD_STATUSES = new Set(['SUCCESS', 'ESCROW_HELD', 'DISPUTED', 'PARTIALLY_REFUNDED']);
const dayMs = 24 * 60 * 60 * 1000;

export function computeAdminStats(now = Date.now()) {
  const users = db.users;
  const techs = db.technicianProfiles;
  const jobsByStatus: Record<string, number> = {};
  for (const j of db.repairJobs) jobsByStatus[j.status] = (jobsByStatus[j.status] || 0) + 1;

  const paid = db.payments.filter((p) => PAID_STATUSES.has(p.status));
  const gmv = paid.reduce((s, p) => s + p.amountNaira, 0);
  const refundedTotal = db.payments.reduce((s, p) => s + (p.refundedAmountNaira || 0), 0);
  const escrowHeld = db.payments
    .filter((p) => HELD_STATUSES.has(p.status))
    .reduce((s, p) => s + Math.max(0, p.amountNaira - (p.refundedAmountNaira || 0)), 0);
  const feesEarned = db.payments.filter((p) => p.status === 'RELEASED_TO_TECHNICIAN').reduce((s, p) => s + p.platformFeeNaira, 0);
  const feesPending = db.payments
    .filter((p) => p.status === 'SUCCESS' || p.status === 'ESCROW_HELD' || p.status === 'DISPUTED')
    .reduce((s, p) => s + p.platformFeeNaira, 0);

  const payoutSum = (statuses: string[]) => db.payouts.filter((p) => statuses.includes(p.status)).reduce((s, p) => s + p.amountNaira, 0);
  const payoutCount = (status: string) => db.payouts.filter((p) => p.status === status).length;

  const pendingKyc = techs.filter((t) => kycState(t) === 'PENDING').length;

  // 14-day trend, Lagos calendar days, oldest first
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(lagosDayKey(now - i * dayMs));
  const trend = new Map(days.map((d) => [d, { date: d, jobs: 0, gmvNaira: 0, newUsers: 0 }]));
  for (const j of db.repairJobs) { const r = trend.get(lagosDayKey(j.createdAt)); if (r) r.jobs++; }
  for (const p of paid) { const r = trend.get(lagosDayKey(p.paidAt || p.createdAt || now)); if (r) r.gmvNaira += p.amountNaira; }
  for (const u of users) { const r = trend.get(lagosDayKey(u.createdAt)); if (r) r.newUsers++; }

  const since = (ms: number) => users.filter((u) => Date.parse(u.createdAt) >= now - ms).length;

  return {
    generatedAt: new Date(now).toISOString(),
    users: {
      total: users.length,
      customers: users.filter((u) => u.role === 'customer').length,
      technicians: users.filter((u) => u.role === 'technician').length,
      admins: users.filter((u) => u.role === 'admin').length,
      suspended: users.filter((u) => u.status === 'suspended').length,
      newLast7Days: since(7 * dayMs),
      newLast30Days: since(30 * dayMs),
    },
    technicians: {
      total: techs.length,
      verified: techs.filter((t) => t.isVerified).length,
      pendingKyc,
      rejectedKyc: techs.filter((t) => kycState(t) === 'REJECTED').length,
      available: techs.filter((t) => t.availability === 'AVAILABLE').length,
    },
    jobs: {
      total: db.repairJobs.length,
      byStatus: jobsByStatus,
      active: db.repairJobs.filter((j) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(j.status)).length,
      completed: jobsByStatus.COMPLETED || 0,
      disputed: jobsByStatus.DISPUTED || 0,
    },
    requests: {
      total: db.repairRequests.length,
      open: db.repairRequests.filter((r) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(r.status)).length,
    },
    money: {
      gmvNaira: gmv,
      paidPayments: paid.length,
      escrowHeldNaira: escrowHeld,
      platformFeesEarnedNaira: feesEarned,
      platformFeesPendingNaira: feesPending,
      refundedNaira: refundedTotal,
    },
    refunds: {
      count: db.refunds.length,
      pending: db.refunds.filter((r) => r.status === 'PENDING').length,
      totalNaira: db.refunds.reduce((s, r) => s + r.amountNaira, 0),
    },
    payouts: {
      count: db.payouts.length,
      awaitingApproval: payoutCount('PENDING'),
      awaitingApprovalNaira: payoutSum(['PENDING']),
      processing: payoutCount('PROCESSING'),
      completedNaira: payoutSum(['COMPLETED']),
      failed: payoutCount('FAILED') + payoutCount('REJECTED'),
    },
    risk: {
      openDisputes: jobsByStatus.DISPUTED || 0,
      unreviewedRiskEvents: db.riskEvents.filter((r) => !r.reviewed).length,
    },
    trend: [...trend.values()],
  };
}

apiRouter.get('/admin/stats', (_req: AuthenticatedRequest, res: Response) => res.json(computeAdminStats()));

/* ------------------------------------------------------------------ users & technicians */

function filterUsers(req: AuthenticatedRequest, res: Response, forceRole?: 'technician') {
  const q = qStr(req.query.q).toLowerCase();
  const roles = forceRole ? [forceRole] : qList(req.query.role);
  const status = qStr(req.query.status, 20);
  const kyc = qStr(req.query.kyc, 20).toUpperCase();
  const from = parseDateParam(res, req.query.from, 'from');
  const to = parseDateParam(res, req.query.to, 'to');
  if (from === undefined || to === undefined) return null;
  const techs = new Map(db.technicianProfiles.map((t) => [t.userId, t]));
  let rows = db.users.filter((u) => {
    if (roles.length && !roles.includes(u.role)) return false;
    if (status && (u.status || 'active') !== status) return false;
    if (from !== null && Date.parse(u.createdAt) < from) return false;
    if (to !== null && Date.parse(u.createdAt) > to) return false;
    const t = techs.get(u.id);
    if (kyc) {
      if (!t || kycState(t) !== kyc) return false;
    }
    if (q) {
      const hit =
        includesCI(u.name, q) || includesCI(u.email, q) || includesCI(u.phone, q) || includesCI(u.id, q) ||
        (t ? includesCI(t.businessName, q) : false);
      if (!hit) return false;
    }
    return true;
  });
  rows = sortItems(rows, req, {
    createdAt: (u) => u.createdAt,
    name: (u) => (u.name || '').toLowerCase(),
    email: (u) => (u.email || '').toLowerCase(),
    lastLoginAt: (u) => u.lastLoginAt || '',
    rating: (u) => techs.get(u.id)?.rating ?? -1,
  }, 'createdAt');
  return { rows, techs };
}

apiRouter.get('/admin/users', (req: AuthenticatedRequest, res: Response) => {
  const f = filterUsers(req, res);
  if (!f) return;
  return res.json(paginate(req, res, f.rows.map((u) => userRow(u, f.techs)), pageOpts));
});

apiRouter.get('/admin/technicians', (req: AuthenticatedRequest, res: Response) => {
  const f = filterUsers(req, res, 'technician');
  if (!f) return;
  return res.json(paginate(req, res, f.rows.map((u) => userRow(u, f.techs)), pageOpts));
});

function userDetail(u: User & { passwordHash: string }) {
  const tech = db.technicianProfiles.find((t) => t.userId === u.id);
  const cust = db.customerProfiles.find((c) => c.userId === u.id);
  const jobs = db.repairJobs.filter((j) => j.customerId === u.id || j.technicianId === u.id);
  const jobRows = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 25).map(jobRow);
  const payments = db.payments.filter((p) => p.customerId === u.id || p.technicianId === u.id).slice(-25).reverse();
  const reviews = db.reviews.filter((r) => r.customerId === u.id || r.technicianId === u.id).slice(-25).reverse();
  const earnings = db.technicianEarnings.filter((e) => e.technicianId === u.id);
  const payouts = db.payouts.filter((p) => p.technicianId === u.id);
  const activity = db.auditLogs.filter((a) => a.actorId === u.id || a.resourceId === u.id).slice(-30).reverse();
  return {
    user: userRow(u),
    customerProfile: cust ? { totalRepairsCount: cust.totalRepairsCount, activeRepairsCount: cust.activeRepairsCount, savedLocations: cust.savedLocations?.length || 0, defaultLocation: cust.defaultLocation } : null,
    technicianProfile: tech || null,
    stats: {
      jobs: jobs.length,
      activeJobs: jobs.filter((j) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(j.status)).length,
      disputedJobs: jobs.filter((j) => j.status === 'DISPUTED').length,
      spentNaira: db.payments.filter((p) => p.customerId === u.id && PAID_STATUSES.has(p.status)).reduce((s, p) => s + p.amountNaira, 0),
      earnedNaira: earnings.filter((e) => ['ELIGIBLE_FOR_PAYOUT', 'PAYOUT_INITIATED', 'PAID_OUT'].includes(e.status)).reduce((s, e) => s + e.netEarningsNaira, 0),
      heldNaira: earnings.filter((e) => e.status === 'HELD').reduce((s, e) => s + e.netEarningsNaira, 0),
      payoutsCompletedNaira: payouts.filter((p) => p.status === 'COMPLETED').reduce((s, p) => s + p.amountNaira, 0),
    },
    recentJobs: jobRows,
    recentPayments: payments,
    recentReviews: reviews,
    recentActivity: activity,
  };
}

function detailHandler(req: AuthenticatedRequest, res: Response) {
  const u = userById(String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found.' });
  return res.json(userDetail(u));
}
apiRouter.get('/admin/users/:id', detailHandler);
apiRouter.get('/admin/technicians/:id', (req: AuthenticatedRequest, res: Response) => {
  const u = userById(String(req.params.id));
  if (!u || u.role !== 'technician') return res.status(404).json({ error: 'Technician not found.' });
  return res.json(userDetail(u));
});

apiRouter.post('/admin/users/:id/suspend', (req: AuthenticatedRequest, res: Response) => {
  const u = userById(String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (u.id === req.user!.id) return res.status(400).json({ error: 'You cannot suspend your own account.', code: 'SELF_ACTION' });
  if (u.role === 'admin' && !db.users.some((x) => x.role === 'admin' && x.id !== u.id && x.status !== 'suspended')) {
    return res.status(409).json({ error: 'This is the last active admin; suspending it would lock everyone out.', code: 'LAST_ADMIN' });
  }
  const reason = reasonOf(req, res);
  if (reason === undefined) return;
  if (!reauth(req, res)) return;
  if (u.status === 'suspended') return res.status(409).json({ error: 'This account is already suspended.' });
  const activeJobs = db.repairJobs.filter((j) => (j.customerId === u.id || j.technicianId === u.id) && !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(j.status)).length;
  u.status = 'suspended';
  u.suspendedAt = new Date().toISOString();
  u.suspendedReason = reason || undefined;
  u.suspendedBy = req.user!.id;
  (u as any).sessionVersion = ((u as any).sessionVersion || 1) + 1; // every session of the user ends now
  audit(req, 'ADMIN_USER_SUSPENDED', 'USER', u.id, { reason, role: u.role, activeJobs });
  db.save();
  return res.json({ success: true, user: userRow(u), activeJobs });
});

apiRouter.post('/admin/users/:id/reactivate', (req: AuthenticatedRequest, res: Response) => {
  const u = userById(String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const note = reasonOf(req, res, { required: false, field: 'reason' });
  if (u.status !== 'suspended') return res.status(409).json({ error: 'This account is not suspended.' });
  u.status = 'active';
  const previous = { at: u.suspendedAt, reason: u.suspendedReason };
  u.suspendedAt = undefined;
  u.suspendedReason = undefined;
  u.suspendedBy = undefined;
  audit(req, 'ADMIN_USER_REACTIVATED', 'USER', u.id, { note, previousSuspension: previous });
  db.save();
  return res.json({ success: true, user: userRow(u) });
});

apiRouter.post('/admin/users/:id/revoke-sessions', (req: AuthenticatedRequest, res: Response) => {
  const u = userById(String(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (!reauth(req, res)) return;
  AdminAuthService.revokeAllSessions(u.id);
  audit(req, 'ADMIN_SESSIONS_REVOKED', 'USER', u.id, { scope: u.id === req.user!.id ? 'self' : 'other' });
  return res.json({ success: true });
});

apiRouter.get('/admin/admins', (req: AuthenticatedRequest, res: Response) => {
  const rows = db.users.filter((u) => u.role === 'admin').map((u) => ({ ...userRow(u), mustChangePassword: Boolean(u.mustChangePassword), isYou: u.id === req.user!.id }));
  return res.json(paginate(req, res, rows, pageOpts));
});

/* --- KYC ------------------------------------------------------------------ */
apiRouter.post('/admin/technicians/:id/kyc', (req: AuthenticatedRequest, res: Response) => {
  const tech = db.technicianProfiles.find((t) => t.userId === String(req.params.id));
  if (!tech) return res.status(404).json({ error: 'Technician not found.' });
  const decision = String(req.body?.decision || '').toUpperCase();
  if (decision !== 'APPROVE' && decision !== 'REJECT') return res.status(400).json({ error: 'decision must be APPROVE or REJECT.' });
  const reason = reasonOf(req, res, { required: decision === 'REJECT' });
  if (reason === undefined) return;
  if (!reauth(req, res)) return;

  const before = { ...tech.verificationStatus, isVerified: Boolean(tech.isVerified) };
  const now = new Date().toISOString();
  if (decision === 'APPROVE') {
    tech.verificationStatus = { ...tech.verificationStatus, basic: true, identityVerified: true, businessVerified: true, locationConfirmed: true };
    tech.isVerified = true;
  } else {
    tech.verificationStatus = { ...tech.verificationStatus, identityVerified: false, businessVerified: false, payoutVerified: false };
    tech.isVerified = false;
  }
  tech.verificationStatus.kycReview = { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewedBy: req.user!.id, reviewedAt: now, reason: reason || undefined };
  audit(req, decision === 'APPROVE' ? 'ADMIN_KYC_APPROVED' : 'ADMIN_KYC_REJECTED', 'TECHNICIAN', tech.userId, { reason, before, after: { ...tech.verificationStatus, isVerified: tech.isVerified } });
  NotificationService.send({
    userId: tech.userId,
    title: decision === 'APPROVE' ? 'Verification Approved' : 'Verification Not Approved',
    message: decision === 'APPROVE'
      ? 'Your Fixhub technician verification was approved. Your shop now shows the Verified badge.'
      : `Your Fixhub technician verification was not approved: ${reason} Please update your details and resubmit.`,
    type: 'SECURITY',
  });
  db.save();
  return res.json({ success: true, technician: tech, kycStatus: kycState(tech) });
});

/* ------------------------------------------------------------------ jobs */

function jobRow(j: RepairJob) {
  const c = userById(j.customerId);
  const t = db.technicianProfiles.find((x) => x.userId === j.technicianId);
  const pay = db.payments.find((p) => p.repairId === j.id && p.status !== 'INITIATED' && p.status !== 'FAILED' && p.status !== 'CANCELLED') || db.payments.find((p) => p.repairId === j.id);
  return {
    id: j.id,
    bookingRef: j.bookingRef || null,
    status: j.status,
    deviceBrand: j.deviceBrand,
    deviceModel: j.deviceModel,
    issues: j.issues,
    customerId: j.customerId,
    customerName: c?.name || '—',
    technicianId: j.technicianId,
    technicianName: t?.businessName || userById(j.technicianId)?.name || '—',
    amountNaira: jobAmount(j),
    platformFeeNaira: j.platformFeeAmount || 0,
    paymentStatus: pay?.status || null,
    createdAt: j.createdAt,
    completedAt: j.completedAt || null,
  };
}

apiRouter.get('/admin/jobs', (req: AuthenticatedRequest, res: Response) => {
  const q = qStr(req.query.q).toLowerCase();
  const statuses = qList(req.query.status).map((s) => s.toUpperCase());
  const customerId = qStr(req.query.customerId);
  const technicianId = qStr(req.query.technicianId);
  const from = parseDateParam(res, req.query.from, 'from');
  const to = parseDateParam(res, req.query.to, 'to');
  if (from === undefined || to === undefined) return;
  let rows = db.repairJobs
    .filter((j) => {
      if (statuses.length && !statuses.includes(j.status)) return false;
      if (customerId && j.customerId !== customerId) return false;
      if (technicianId && j.technicianId !== technicianId) return false;
      if (from !== null && Date.parse(j.createdAt) < from) return false;
      if (to !== null && Date.parse(j.createdAt) > to) return false;
      return true;
    })
    .map(jobRow);
  if (q) {
    rows = rows.filter((r) => [r.id, r.bookingRef, r.customerName, r.technicianName, r.deviceBrand, r.deviceModel].some((v) => includesCI(v, q)));
  }
  rows = sortItems(rows, req, { createdAt: (r) => r.createdAt, amount: (r) => r.amountNaira, status: (r) => r.status }, 'createdAt');
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.get('/admin/jobs/:id', (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === String(req.params.id));
  if (!job) return res.status(404).json({ error: 'Repair job not found.' });
  const customer = userById(job.customerId);
  const tech = db.technicianProfiles.find((t) => t.userId === job.technicianId);
  return res.json({
    job,
    summary: jobRow(job),
    customer: customer ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, status: customer.status || 'active' } : null,
    technician: tech ? { userId: tech.userId, businessName: tech.businessName, phone: tech.phone, rating: tech.rating, isVerified: Boolean(tech.isVerified), status: userById(tech.userId)?.status || 'active' } : null,
    payment: db.payments.find((p) => p.repairId === job.id) || null,
    payments: db.payments.filter((p) => p.repairId === job.id),
    refunds: db.refunds.filter((r) => r.repairId === job.id),
    earnings: db.technicianEarnings.filter((e) => e.repairId === job.id),
    quote: db.repairQuotes.find((q) => q.id === job.quoteId) || null,
    reviews: db.reviews.filter((r) => r.repairId === job.id),
    messageCount: db.messages.filter((m) => m.repairId === job.id).length,
    auditTrail: db.auditLogs.filter((a) => a.resourceId === job.id).slice(-50).reverse(),
    allowedActions: {
      cancel: ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'BOOKED', 'DEVICE_DROPPED_OFF', 'DEVICE_RECEIVED', 'DIAGNOSING', 'ADDITIONAL_DIAGNOSIS', 'DISPUTED'].includes(job.status),
      dispute: !['COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED'].includes(job.status),
      resolveDispute: job.status === 'DISPUTED',
    },
  });
});

/** Chat transcript: private, so reading it is an audited action (typically needed to judge a dispute). */
apiRouter.get('/admin/jobs/:id/messages', (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === String(req.params.id));
  if (!job) return res.status(404).json({ error: 'Repair job not found.' });
  const msgs = db.messages.filter((m) => m.repairId === job.id);
  audit(req, 'ADMIN_VIEWED_JOB_MESSAGES', 'REPAIR_JOB', job.id, { count: msgs.length });
  return res.json(paginate(req, res, msgs, { defaultLimit: 200, maxLimit: 1000 }));
});

apiRouter.post('/admin/jobs/:id/force-status', async (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === String(req.params.id));
  if (!job) return res.status(404).json({ error: 'Repair job not found.' });
  const target = String(req.body?.status || '').toUpperCase();
  if (target !== 'CANCELLED' && target !== 'DISPUTED') {
    return res.status(400).json({ error: 'Admins can force a job to CANCELLED (refunds automatically when paid) or DISPUTED. Use dispute resolution to finish a disputed job.', code: 'STATUS_NOT_ALLOWED' });
  }
  const reason = reasonOf(req, res);
  if (reason === undefined) return;
  if (!reauth(req, res)) return;
  const previous = job.status;

  if (target === 'CANCELLED') {
    const r = await RepairWorkflowService.cancelJob({ jobId: job.id, actorId: req.user!.id, actorRole: 'admin', reason: reason || undefined });
    if (!r.success) return res.status(400).json({ error: r.error || 'Could not cancel the job.' });
    audit(req, 'ADMIN_JOB_FORCE_CANCELLED', 'REPAIR_JOB', job.id, { previous, reason, refunded: Boolean(r.refunded), refundAmountNaira: r.refundAmountNaira || 0 });
    return res.json({ success: true, job: jobRow(job), refunded: Boolean(r.refunded), refundAmountNaira: r.refundAmountNaira || 0 });
  }
  const r = RepairWorkflowService.disputeJob({ jobId: job.id, actorId: req.user!.id, actorRole: 'admin', reason: reason || 'Opened by Fixhub admin' });
  if (!r.success) return res.status(400).json({ error: r.error || 'Could not open a dispute.' });
  audit(req, 'ADMIN_JOB_DISPUTE_OPENED', 'REPAIR_JOB', job.id, { previous, reason });
  return res.json({ success: true, job: jobRow(job) });
});

/* ------------------------------------------------------------------ disputes & risk */

apiRouter.get('/admin/disputes', (req: AuthenticatedRequest, res: Response) => {
  const disputed = db.repairJobs.filter((j) => j.status === 'DISPUTED');
  return res.json(paginate(req, res, disputed, pageOpts));
});

apiRouter.post('/admin/disputes/:jobId/resolve', async (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === String(req.params.jobId));
  if (!job) return res.status(404).json({ error: 'Disputed job not found.' });
  if (job.status !== 'DISPUTED') return res.status(400).json({ error: 'Job is not currently in DISPUTED status.' });
  const decision = String(req.body?.decision || '');
  if (!['REFUND_CUSTOMER', 'RELEASE_TECHNICIAN', 'RETURN_TO_REPAIR'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision. Must be REFUND_CUSTOMER, RELEASE_TECHNICIAN or RETURN_TO_REPAIR.' });
  }
  const notes = sanitizeString(req.body?.resolutionNotes ?? req.body?.reason, 500);
  if (notes.length < 3) return res.status(400).json({ error: 'Resolution notes (at least 3 characters) are required.', code: 'REASON_REQUIRED' });
  if (!reauth(req, res)) return;

  const now = new Date().toISOString();
  const payment = db.payments.find((p) => p.repairId === job.id && ['SUCCESS', 'ESCROW_HELD', 'PARTIALLY_REFUNDED'].includes(p.status));

  if (decision === 'REFUND_CUSTOMER') {
    if (payment?.status === 'PARTIALLY_REFUNDED') {
      return res.status(400).json({ error: 'This payment was already partially refunded. Issue the remaining refund from Payments, then cancel the job.', code: 'PARTIAL_REFUND' });
    }
    if (payment) {
      const r = await PaymentService.recordRefund({ paymentId: payment.id, reason: `Dispute resolved in customer's favour: ${notes}`, actorId: req.user!.id, actorRole: 'admin' });
      if (!r.success) return res.status(400).json({ error: r.error || 'Refund failed.' }); // the job is left DISPUTED
    } else {
      job.status = 'CANCELLED';
      job.statusHistory.push({ status: 'CANCELLED', timestamp: now, actorRole: 'admin', note: `Dispute resolved (no payment to refund): ${notes}` });
    }
  } else if (decision === 'RELEASE_TECHNICIAN') {
    const r = PaymentService.releaseTechnicianFunds({ repairJobId: job.id, actorId: req.user!.id, actorRole: 'admin' });
    if (!r.success) return res.status(400).json({ error: r.error || 'Could not release the funds.' });
    job.status = 'COMPLETED';
    job.completedAt = now;
    job.statusHistory.push({ status: 'COMPLETED', timestamp: now, actorRole: 'admin', note: `Dispute resolved in technician's favour: ${notes}` });
    const tech = db.technicianProfiles.find((t) => t.userId === job.technicianId);
    if (tech) tech.completedJobs = (tech.completedJobs || 0) + 1;
  } else {
    job.status = 'REPAIR_IN_PROGRESS';
    job.statusHistory.push({ status: 'REPAIR_IN_PROGRESS', timestamp: now, actorRole: 'admin', note: `Dispute closed, repair resumes: ${notes}` });
  }

  for (const uid of [job.customerId, job.technicianId]) {
    NotificationService.send({
      userId: uid,
      title: 'Dispute Resolved',
      message: `Fixhub support resolved the dispute on repair #${job.bookingRef || job.id}: ${
        decision === 'REFUND_CUSTOMER' ? 'the customer is refunded' : decision === 'RELEASE_TECHNICIAN' ? 'payment is released to the technician' : 'the repair resumes'
      }. ${notes}`,
      type: 'STATUS_CHANGE',
      repairId: job.id,
    });
  }
  audit(req, 'ADMIN_DISPUTE_RESOLVED', 'REPAIR_JOB', job.id, { decision, notes, resultingStatus: job.status });
  db.save();
  return res.json({ success: true, job: jobRow(job), decision });
});

apiRouter.get('/admin/risk-events', (req: AuthenticatedRequest, res: Response) => {
  const reviewed = qStr(req.query.reviewed, 5);
  const severity = qStr(req.query.severity, 10).toUpperCase();
  const q = qStr(req.query.q).toLowerCase();
  let rows = db.riskEvents.filter((r) => {
    if (reviewed === 'true' && !r.reviewed) return false;
    if (reviewed === 'false' && r.reviewed) return false;
    if (severity && r.severity !== severity) return false;
    if (q && !(includesCI(r.eventType, q) || includesCI(r.actorId, q) || includesCI(userById(r.actorId)?.name, q))) return false;
    return true;
  }).map((r) => ({ ...r, actorName: userById(r.actorId)?.name || null }));
  rows = sortItems(rows, req, { timestamp: (r) => r.timestamp, severity: (r) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 } as Record<string, number>)[r.severity] || 0 }, 'timestamp');
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.post('/admin/risk-events/:id/review', (req: AuthenticatedRequest, res: Response) => {
  const ev = db.riskEvents.find((r) => r.id === String(req.params.id));
  if (!ev) return res.status(404).json({ error: 'Risk event not found.' });
  if (ev.reviewed) return res.status(409).json({ error: 'This risk event was already reviewed.' });
  const note = reasonOf(req, res, { required: false, field: 'note' });
  ev.reviewed = true;
  ev.reviewedBy = req.user!.id;
  ev.reviewedAt = new Date().toISOString();
  ev.reviewNote = note || undefined;
  audit(req, 'ADMIN_RISK_EVENT_REVIEWED', 'RISK_EVENT', ev.id, { eventType: ev.eventType, note });
  db.save();
  return res.json({ success: true, event: ev });
});

/* ------------------------------------------------------------------ money: payments, escrow, refunds, payouts */

function paymentRow(p: PaymentTransaction) {
  return { ...p, customerName: userById(p.customerId)?.name || '—', technicianName: db.technicianProfiles.find((t) => t.userId === p.technicianId)?.businessName || userById(p.technicianId)?.name || '—' };
}

function filterPayments(req: AuthenticatedRequest, res: Response) {
  const q = qStr(req.query.q).toLowerCase();
  const statuses = qList(req.query.status).map((s) => s.toUpperCase());
  const from = parseDateParam(res, req.query.from, 'from');
  const to = parseDateParam(res, req.query.to, 'to');
  if (from === undefined || to === undefined) return null;
  let rows = db.payments
    .filter((p) => {
      if (statuses.length && !statuses.includes(p.status)) return false;
      const at = Date.parse(p.paidAt || p.createdAt || '');
      if (from !== null && at < from) return false;
      if (to !== null && at > to) return false;
      return true;
    })
    .map(paymentRow);
  if (q) rows = rows.filter((r) => [r.id, r.transactionRef, r.providerReference, r.repairId, r.customerName, r.technicianName, userById(r.customerId)?.email].some((v) => includesCI(v, q)));
  return sortItems(rows, req, { createdAt: (r) => r.createdAt || '', amount: (r) => r.amountNaira, status: (r) => r.status }, 'createdAt');
}

apiRouter.get('/admin/payments', (req: AuthenticatedRequest, res: Response) => {
  const rows = filterPayments(req, res);
  if (!rows) return;
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.get('/admin/payments/:id', (req: AuthenticatedRequest, res: Response) => {
  const p = db.payments.find((x) => x.id === String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Payment not found.' });
  return res.json({
    payment: paymentRow(p),
    refunds: db.refunds.filter((r) => r.paymentId === p.id),
    earnings: db.technicianEarnings.filter((e) => e.paymentId === p.id || e.repairId === p.repairId),
    job: db.repairJobs.find((j) => j.id === p.repairId) ? jobRow(db.repairJobs.find((j) => j.id === p.repairId)!) : null,
    auditTrail: db.auditLogs.filter((a) => a.resourceId === p.id).slice(-30).reverse(),
  });
});

apiRouter.post('/admin/payments/reconcile', async (req: AuthenticatedRequest, res: Response) => {
  if (!reauth(req, res)) return;
  const maxAgeHours = Number(req.body?.maxAgeHours);
  const result = await PaymentService.reconcilePendingPayments({ maxAgeHours: Number.isFinite(maxAgeHours) && maxAgeHours > 0 ? Math.min(maxAgeHours, 24 * 30) : 48 });
  audit(req, 'ADMIN_PAYMENTS_RECONCILED', 'PAYMENT', 'batch', { checked: result.checkedCount, reconciled: result.reconciledCount, failed: result.failedCount });
  return res.json(result);
});

apiRouter.post('/admin/payments/:id/refund', async (req: AuthenticatedRequest, res: Response) => {
  const p = db.payments.find((x) => x.id === String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Payment not found.' });
  const reason = reasonOf(req, res);
  if (reason === undefined) return;
  let amount: number | undefined;
  if (req.body?.amountNaira !== undefined && req.body.amountNaira !== '') {
    amount = Math.round(Number(req.body.amountNaira));
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Refund amount must be a positive number of Naira.' });
  }
  if (!reauth(req, res)) return;
  const result = await PaymentService.recordRefund({ paymentId: p.id, amountNaira: amount, reason: reason!, actorId: req.user!.id, actorRole: 'admin' });
  if (!result.success) return res.status(400).json({ error: result.error });
  audit(req, 'ADMIN_REFUND_ISSUED', 'PAYMENT', p.id, { amountNaira: result.refund?.amountNaira, reason, refundId: result.refund?.id });
  return res.json({ success: true, refund: result.refund, payment: paymentRow(p) });
});

apiRouter.get('/admin/refunds', (req: AuthenticatedRequest, res: Response) => {
  const statuses = qList(req.query.status).map((s) => s.toUpperCase());
  const q = qStr(req.query.q).toLowerCase();
  let rows = db.refunds
    .filter((r) => !statuses.length || statuses.includes(r.status))
    .map((r) => ({ ...r, customerName: userById(r.customerId)?.name || '—', paymentStatus: db.payments.find((p) => p.id === r.paymentId)?.status || null }));
  if (q) rows = rows.filter((r) => [r.id, r.paymentId, r.repairId, r.customerName, r.reason].some((v) => includesCI(v, q)));
  rows = sortItems(rows, req, { createdAt: (r) => r.createdAt, amount: (r) => r.amountNaira }, 'createdAt');
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.get('/admin/escrow', (req: AuthenticatedRequest, res: Response) => {
  const statuses = qList(req.query.status).map((s) => s.toUpperCase());
  const q = qStr(req.query.q).toLowerCase();
  let rows = db.technicianEarnings
    .filter((e) => !statuses.length || statuses.includes(e.status))
    .map((e) => ({ ...e, technicianName: db.technicianProfiles.find((t) => t.userId === e.technicianId)?.businessName || userById(e.technicianId)?.name || '—' }));
  if (q) rows = rows.filter((r) => [r.id, r.repairId, r.paymentId, r.technicianName].some((v) => includesCI(v, q)));
  rows = sortItems(rows, req, { createdAt: (r) => r.createdAt, amount: (r) => r.grossAmountNaira, status: (r) => r.status }, 'createdAt');
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.get('/admin/payouts', (req: AuthenticatedRequest, res: Response) => {
  const statuses = qList(req.query.status).map((s) => s.toUpperCase());
  const q = qStr(req.query.q).toLowerCase();
  let rows = db.payouts
    .filter((p) => !statuses.length || statuses.includes(p.status))
    .map((p) => ({ ...p, technicianName: db.technicianProfiles.find((t) => t.userId === p.technicianId)?.businessName || userById(p.technicianId)?.name || '—' }));
  if (q) rows = rows.filter((r) => [r.id, r.technicianName, r.providerReference, r.destinationAccount?.bankName].some((v) => includesCI(v, q)));
  rows = sortItems(rows, req, { createdAt: (r) => r.createdAt, amount: (r) => r.amountNaira, status: (r) => r.status }, 'createdAt');
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.post('/admin/payouts/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  const payout = db.payouts.find((p) => p.id === String(req.params.id));
  if (!payout) return res.status(404).json({ error: 'Payout not found.' });
  if (!reauth(req, res)) return;
  const r = await PaymentService.approvePendingPayout({ payoutId: payout.id, actorId: req.user!.id });
  if (!r.success) return res.status(400).json({ error: r.error });
  audit(req, 'ADMIN_PAYOUT_APPROVED', 'PAYOUT', payout.id, { amountNaira: payout.amountNaira, technicianId: payout.technicianId, status: payout.status });
  return res.json({ success: true, payout });
});

apiRouter.post('/admin/payouts/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  const payout = db.payouts.find((p) => p.id === String(req.params.id));
  if (!payout) return res.status(404).json({ error: 'Payout not found.' });
  const reason = reasonOf(req, res);
  if (reason === undefined) return;
  if (!reauth(req, res)) return;
  const r = await PaymentService.rejectPendingPayout({ payoutId: payout.id, actorId: req.user!.id, reason: reason! });
  if (!r.success) return res.status(400).json({ error: r.error });
  audit(req, 'ADMIN_PAYOUT_REJECTED', 'PAYOUT', payout.id, { amountNaira: payout.amountNaira, technicianId: payout.technicianId, reason });
  return res.json({ success: true, payout });
});

/* ------------------------------------------------------------------ reviews moderation */

apiRouter.get('/admin/reviews', (req: AuthenticatedRequest, res: Response) => {
  const q = qStr(req.query.q).toLowerCase();
  const hidden = qStr(req.query.hidden, 5);
  const rating = Number(qStr(req.query.rating, 2));
  const technicianId = qStr(req.query.technicianId);
  let rows = db.reviews
    .filter((r) => {
      if (hidden === 'true' && !r.hidden) return false;
      if (hidden === 'false' && r.hidden) return false;
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5 && r.rating !== rating) return false;
      if (technicianId && r.technicianId !== technicianId) return false;
      return true;
    })
    .map((r) => ({ ...r, technicianName: db.technicianProfiles.find((t) => t.userId === r.technicianId)?.businessName || '—' }));
  if (q) rows = rows.filter((r) => [r.comment, r.customerName, r.technicianName, r.repairId, r.id].some((v) => includesCI(v, q)));
  rows = sortItems(rows, req, { createdAt: (r) => r.createdAt, rating: (r) => r.rating }, 'createdAt');
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.post('/admin/reviews/:id/hide', (req: AuthenticatedRequest, res: Response) => {
  const review = db.reviews.find((r) => r.id === String(req.params.id));
  if (!review) return res.status(404).json({ error: 'Review not found.' });
  const reason = reasonOf(req, res);
  if (reason === undefined) return;
  if (review.hidden) return res.status(409).json({ error: 'This review is already hidden.' });
  review.hidden = true;
  review.hiddenReason = reason || undefined;
  review.hiddenBy = req.user!.id;
  review.hiddenAt = new Date().toISOString();
  recomputeTechnicianRating(review.technicianId);
  audit(req, 'ADMIN_REVIEW_HIDDEN', 'REVIEW', review.id, { reason, technicianId: review.technicianId, rating: review.rating });
  db.save();
  return res.json({ success: true, review });
});

apiRouter.post('/admin/reviews/:id/unhide', (req: AuthenticatedRequest, res: Response) => {
  const review = db.reviews.find((r) => r.id === String(req.params.id));
  if (!review) return res.status(404).json({ error: 'Review not found.' });
  if (!review.hidden) return res.status(409).json({ error: 'This review is not hidden.' });
  review.hidden = false;
  review.hiddenReason = undefined;
  review.hiddenBy = undefined;
  review.hiddenAt = undefined;
  recomputeTechnicianRating(review.technicianId);
  audit(req, 'ADMIN_REVIEW_RESTORED', 'REVIEW', review.id, { technicianId: review.technicianId });
  db.save();
  return res.json({ success: true, review });
});

apiRouter.delete('/admin/reviews/:id', (req: AuthenticatedRequest, res: Response) => {
  const idx = db.reviews.findIndex((r) => r.id === String(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Review not found.' });
  const reason = reasonOf(req, res);
  if (reason === undefined) return;
  if (!reauth(req, res)) return;
  const [removed] = db.reviews.splice(idx, 1);
  recomputeTechnicianRating(removed.technicianId);
  audit(req, 'ADMIN_REVIEW_REMOVED', 'REVIEW', removed.id, { reason, technicianId: removed.technicianId, snapshot: { rating: removed.rating, comment: removed.comment, customerId: removed.customerId, repairId: removed.repairId } });
  db.save();
  return res.json({ success: true });
});

/* ------------------------------------------------------------------ audit log viewer */

apiRouter.get('/admin/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  const q = qStr(req.query.q).toLowerCase();
  const actorId = qStr(req.query.actorId);
  const action = qStr(req.query.action).toUpperCase();
  const resourceType = qStr(req.query.resourceType).toUpperCase();
  const resourceId = qStr(req.query.resourceId);
  const from = parseDateParam(res, req.query.from, 'from');
  const to = parseDateParam(res, req.query.to, 'to');
  if (from === undefined || to === undefined) return;
  let rows = db.auditLogs
    .filter((a) => {
      if (actorId && a.actorId !== actorId) return false;
      if (action && !a.action.toUpperCase().includes(action)) return false;
      if (resourceType && a.resourceType.toUpperCase() !== resourceType) return false;
      if (resourceId && a.resourceId !== resourceId) return false;
      const at = Date.parse(a.timestamp);
      if (from !== null && at < from) return false;
      if (to !== null && at > to) return false;
      return true;
    })
    .map((a) => ({ ...a, actorName: userById(a.actorId)?.name || null }));
  if (q) rows = rows.filter((a) => [a.action, a.resourceId, a.actorId, a.actorName, JSON.stringify(a.details)].some((v) => includesCI(v, q)));
  rows = sortItems(rows, req, { timestamp: (a) => a.timestamp, action: (a) => a.action }, 'timestamp');
  return res.json(paginate(req, res, rows, pageOpts));
});

/* ------------------------------------------------------------------ announcements (broadcast notifications) */

apiRouter.get('/admin/announcements', (req: AuthenticatedRequest, res: Response) => {
  const rows = db.auditLogs
    .filter((a) => a.action === 'ADMIN_ANNOUNCEMENT_SENT')
    .map((a) => ({ id: a.resourceId, sentAt: a.timestamp, sentBy: a.actorId, sentByName: userById(a.actorId)?.name || null, ...(a.details as object) }))
    .reverse();
  return res.json(paginate(req, res, rows, pageOpts));
});

apiRouter.post('/admin/announcements', adminBulkRateLimiter, (req: AuthenticatedRequest, res: Response) => {
  const title = sanitizeString(req.body?.title, 80);
  const message = sanitizeString(req.body?.message, 500);
  const audience = String(req.body?.audience || 'all');
  if (title.length < 3) return res.status(400).json({ error: 'A title of at least 3 characters is required.' });
  if (message.length < 5) return res.status(400).json({ error: 'A message of at least 5 characters is required.' });
  if (!['all', 'customers', 'technicians'].includes(audience)) return res.status(400).json({ error: 'audience must be all, customers or technicians.' });
  if (!reauth(req, res)) return;

  const recipients = db.users.filter((u) => u.role !== 'admin' && u.status !== 'suspended' && (audience === 'all' || (audience === 'customers' ? u.role === 'customer' : u.role === 'technician')));
  const announcementId = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  for (const u of recipients) {
    const n = NotificationService.send({ userId: u.id, title, message, type: 'ANNOUNCEMENT' });
    n.announcementId = announcementId;
  }
  audit(req, 'ADMIN_ANNOUNCEMENT_SENT', 'ANNOUNCEMENT', announcementId, { title, message, audience, recipients: recipients.length });
  db.save();
  return res.status(201).json({ success: true, announcementId, recipients: recipients.length });
});

/* ------------------------------------------------------------------ CSV exports */

const EXPORT_LIMIT = 50_000;
type Ledger = { columns: CsvColumn<any>[]; rows: (req: AuthenticatedRequest, res: Response) => any[] | null };
const LEDGERS: Record<string, Ledger> = {
  payments: {
    rows: (req, res) => filterPayments(req, res),
    columns: [
      { header: 'Payment ID', value: (p) => p.id },
      { header: 'Job ID', value: (p) => p.repairId },
      { header: 'Reference', value: (p) => p.transactionRef },
      { header: 'Status', value: (p) => p.status },
      { header: 'Customer', value: (p) => p.customerName },
      { header: 'Technician', value: (p) => p.technicianName },
      { header: 'Amount (NGN)', value: (p) => p.amountNaira },
      { header: 'Platform fee (NGN)', value: (p) => p.platformFeeNaira },
      { header: 'Technician payout (NGN)', value: (p) => p.technicianPayoutNaira },
      { header: 'Refunded (NGN)', value: (p) => p.refundedAmountNaira || 0 },
      { header: 'Method', value: (p) => p.paymentMethod },
      { header: 'Created', value: (p) => p.createdAt },
      { header: 'Paid', value: (p) => p.paidAt },
      { header: 'Released', value: (p) => p.releasedAt },
    ],
  },
  refunds: {
    rows: () => db.refunds.map((r) => ({ ...r, customerName: userById(r.customerId)?.name || '' })),
    columns: [
      { header: 'Refund ID', value: (r) => r.id },
      { header: 'Payment ID', value: (r) => r.paymentId },
      { header: 'Job ID', value: (r) => r.repairId },
      { header: 'Customer', value: (r) => r.customerName },
      { header: 'Amount (NGN)', value: (r) => r.amountNaira },
      { header: 'Status', value: (r) => r.status },
      { header: 'Reason', value: (r) => r.reason },
      { header: 'Initiated by', value: (r) => r.initiatedBy },
      { header: 'Created', value: (r) => r.createdAt },
    ],
  },
  payouts: {
    rows: () => db.payouts.map((p) => ({ ...p, technicianName: db.technicianProfiles.find((t) => t.userId === p.technicianId)?.businessName || '' })),
    columns: [
      { header: 'Payout ID', value: (p) => p.id },
      { header: 'Technician', value: (p) => p.technicianName },
      { header: 'Amount (NGN)', value: (p) => p.amountNaira },
      { header: 'Status', value: (p) => p.status },
      { header: 'Bank', value: (p) => p.destinationAccount?.bankName },
      { header: 'Account (masked)', value: (p) => maskAccountNumber(p.destinationAccount?.accountNumber) },
      { header: 'Provider reference', value: (p) => p.providerReference },
      { header: 'Created', value: (p) => p.createdAt },
      { header: 'Processed', value: (p) => p.processedAt },
      { header: 'Failure reason', value: (p) => p.failureReason },
    ],
  },
  earnings: {
    rows: () => db.technicianEarnings.map((e) => ({ ...e, technicianName: db.technicianProfiles.find((t) => t.userId === e.technicianId)?.businessName || '' })),
    columns: [
      { header: 'Earnings ID', value: (e) => e.id },
      { header: 'Job ID', value: (e) => e.repairId },
      { header: 'Technician', value: (e) => e.technicianName },
      { header: 'Gross (NGN)', value: (e) => e.grossAmountNaira },
      { header: 'Platform fee (NGN)', value: (e) => e.platformFeeNaira },
      { header: 'Net (NGN)', value: (e) => e.netEarningsNaira },
      { header: 'Status', value: (e) => e.status },
      { header: 'Created', value: (e) => e.createdAt },
      { header: 'Released', value: (e) => e.releasedAt },
      { header: 'Paid out', value: (e) => e.paidOutAt },
    ],
  },
  jobs: {
    rows: () => db.repairJobs.map(jobRow),
    columns: [
      { header: 'Job ID', value: (j) => j.id },
      { header: 'Booking ref', value: (j) => j.bookingRef },
      { header: 'Status', value: (j) => j.status },
      { header: 'Device', value: (j) => `${j.deviceBrand} ${j.deviceModel}` },
      { header: 'Customer', value: (j) => j.customerName },
      { header: 'Technician', value: (j) => j.technicianName },
      { header: 'Amount (NGN)', value: (j) => j.amountNaira },
      { header: 'Platform fee (NGN)', value: (j) => j.platformFeeNaira },
      { header: 'Payment status', value: (j) => j.paymentStatus },
      { header: 'Created', value: (j) => j.createdAt },
      { header: 'Completed', value: (j) => j.completedAt },
    ],
  },
  'audit-logs': {
    rows: () => db.auditLogs.map((a) => scrubForAdmin({ ...a, actorName: userById(a.actorId)?.name || '' })),
    columns: [
      { header: 'Time', value: (a) => a.timestamp },
      { header: 'Actor', value: (a) => a.actorName || a.actorId },
      { header: 'Actor ID', value: (a) => a.actorId },
      { header: 'Role', value: (a) => a.actorRole },
      { header: 'Action', value: (a) => a.action },
      { header: 'Resource type', value: (a) => a.resourceType },
      { header: 'Resource ID', value: (a) => a.resourceId },
      { header: 'IP', value: (a) => a.ipAddress },
      { header: 'Details', value: (a) => a.details },
    ],
  },
};

apiRouter.get('/admin/export/:ledger.csv', adminBulkRateLimiter, (req: AuthenticatedRequest, res: Response) => {
  const ledger = LEDGERS[String(req.params.ledger)];
  if (!ledger) return res.status(404).json({ error: `Unknown ledger. Available: ${Object.keys(LEDGERS).join(', ')}.` });
  const rows = ledger.rows(req, res);
  if (!rows) return;
  const limited = rows.slice(0, EXPORT_LIMIT);
  audit(req, 'ADMIN_LEDGER_EXPORTED', 'EXPORT', String(req.params.ledger), { rows: limited.length, truncated: rows.length > limited.length, filters: { status: qStr(req.query.status), from: qStr(req.query.from), to: qStr(req.query.to) } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fixhub-${req.params.ledger}-${lagosDayKey(Date.now())}.csv"`);
  res.setHeader('X-Total-Count', String(rows.length));
  return res.send('\uFEFF' + toCsv(limited, ledger.columns)); // BOM: Excel opens UTF-8 (₦, names) correctly
});

export { formatNaira };

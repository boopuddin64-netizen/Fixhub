import { Response } from 'express';
import { db } from '../../db';
import { AuditService } from '../../services/auditService';
import { AdminAuthService, adminReauthRequired } from '../../services/adminAuthService';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole } from './shared';

/* -------------------------------------------------------------
 * 11B. LEGACY ADMIN ENDPOINTS (kept for API compatibility; the admin portal lives in adminPortal.ts)
 *  - POST /admin/technicians/:id/verify   (no longer creates users/profiles; audited; requires admin re-auth)
 *  - POST /dev/reset-seed                 (development only)
 * GET /admin/disputes and POST /admin/disputes/:jobId/resolve moved to adminPortal.ts (same paths, richer + audited).
 * ----------------------------------------------------------- */
apiRouter.post('/admin/technicians/:id/verify', requireAuth, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  if (adminReauthRequired()) {
    const check = AdminAuthService.confirmPassword(req.user!.id, req.body?.adminPassword);
    if (!check.ok) {
      return res.status(check.reason === 'LOCKED' ? 423 : 403).json({ error: 'Admin password confirmation failed.', code: 'ADMIN_REAUTH_FAILED' });
    }
  }
  const techId = String(req.params.id);
  const tech = db.technicianProfiles.find((t) => t.userId === techId || (t as any).id === techId);
  if (!tech) {
    return res.status(404).json({ error: 'Technician not found.' });
  }

  const before = { ...tech.verificationStatus, isVerified: Boolean(tech.isVerified) };
  const { basic, locationConfirmed, identityVerified, businessVerified, payoutVerified, isVerified } = req.body;
  const flag = (v: unknown, current: boolean | undefined, dflt: boolean) => (typeof v === 'boolean' ? v : current ?? dflt);

  tech.verificationStatus = {
    ...tech.verificationStatus,
    basic: flag(basic, tech.verificationStatus?.basic, true),
    locationConfirmed: flag(locationConfirmed, tech.verificationStatus?.locationConfirmed, false),
    identityVerified: flag(identityVerified, tech.verificationStatus?.identityVerified, false),
    businessVerified: flag(businessVerified, tech.verificationStatus?.businessVerified, false),
    payoutVerified: flag(payoutVerified, tech.verificationStatus?.payoutVerified, false),
  };

  tech.isVerified =
    typeof isVerified === 'boolean'
      ? isVerified
      : tech.verificationStatus.identityVerified && tech.verificationStatus.businessVerified && tech.verificationStatus.locationConfirmed;

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'admin',
    action: 'ADMIN_TECHNICIAN_VERIFICATION_UPDATED',
    resourceType: 'TECHNICIAN',
    resourceId: tech.userId,
    details: { before, after: { ...tech.verificationStatus, isVerified: tech.isVerified }, via: 'legacy-endpoint' },
    ipAddress: req.ip,
  });
  db.save();
  return res.json({ success: true, technician: { ...tech, bankChangeVerification: undefined } });
});

/* -------------------------------------------------------------
 * 12. DEMO / TEST RESET (Gated behind admin auth & excluded in production)
 * ----------------------------------------------------------- */
apiRouter.post('/dev/reset-seed', requireAuth, requireRole(['admin']), (_req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint not available in production' });
  }
  db.resetToSeed();
  return res.json({ success: true, message: 'Database reset to initial test seed data.' });
});

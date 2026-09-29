import { Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { PaymentService } from '../../services/paymentService';
import { paginate } from '../../utils/pagination';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole } from './shared';

/* -------------------------------------------------------------
 * 11B. ADMIN VERIFICATION & DISPUTES ENDPOINTS
 * ----------------------------------------------------------- */
apiRouter.post('/admin/technicians/:id/verify', requireAuth, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const techId = req.params.id;
  let tech = db.technicianProfiles.find((t) => t.userId === techId || (t as any).id === techId);
  if (!tech) {
    let user = db.users.find((u) => u.id === techId || (u.email && u.email.toLowerCase() === techId.toLowerCase()));
    if (!user) {
      user = {
        id: techId,
        email: techId.includes('@') ? techId : `tech_${techId}@fixhub.local`,
        name: techId.includes('@') ? techId.split('@')[0] : 'Fixhub Technician',
        phone: '',
        role: 'technician',
        createdAt: new Date().toISOString(),
        emailVerified: true,
        phoneVerified: false,
        passwordHash: '',
      };
      db.users.push(user);
    }
    tech = AuthService.ensureTechnicianProfile(user);
  }

  const { basic, locationConfirmed, identityVerified, businessVerified, payoutVerified, isVerified } = req.body;

  tech.verificationStatus = {
    basic: basic ?? tech.verificationStatus?.basic ?? true,
    locationConfirmed: locationConfirmed ?? tech.verificationStatus?.locationConfirmed ?? false,
    identityVerified: identityVerified ?? tech.verificationStatus?.identityVerified ?? false,
    businessVerified: businessVerified ?? tech.verificationStatus?.businessVerified ?? false,
    payoutVerified: payoutVerified ?? tech.verificationStatus?.payoutVerified ?? false,
  };

  (tech as any).isVerified = isVerified ?? (
    tech.verificationStatus.identityVerified &&
    tech.verificationStatus.businessVerified &&
    tech.verificationStatus.locationConfirmed
  );

  return res.json({ success: true, technician: tech });
});

apiRouter.get('/admin/disputes', requireAuth, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const disputedJobs = db.repairJobs.filter((j) => j.status === 'DISPUTED');
  return res.json(paginate(req, res, disputedJobs));
});

apiRouter.post('/admin/disputes/:jobId/resolve', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;
  const { decision, resolutionNotes } = req.body;

  const job = db.repairJobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ error: 'Disputed job not found.' });
  }

  if (job.status !== 'DISPUTED') {
    return res.status(400).json({ error: 'Job is not currently in DISPUTED status.' });
  }

  if (decision === 'REFUND_CUSTOMER') {
    job.status = 'CANCELLED';
    const payment = db.payments.find((p) => p.repairId === job.id);
    if (payment) {
      await PaymentService.recordRefund({
        paymentId: payment.id,
        reason: resolutionNotes || 'Admin dispute resolution: Customer refund approved',
        actorId: req.user!.id,
        actorRole: 'admin',
      });
    }
  } else if (decision === 'RELEASE_TECHNICIAN') {
    job.status = 'COMPLETED';
    await PaymentService.releaseTechnicianFunds(
      job.id,
      req.user!.id,
      'admin'
    );
  } else {
    return res.status(400).json({ error: 'Invalid decision. Must be REFUND_CUSTOMER or RELEASE_TECHNICIAN.' });
  }

  return res.json({ success: true, job, decision });
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

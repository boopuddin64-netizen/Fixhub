import { Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { RepairWorkflowService } from '../../services/repairWorkflowService';
import { AuditService } from '../../services/auditService';
import { NotificationService } from '../../services/notificationService';
import { paginate } from '../../utils/pagination';
import { RepairLifecycleStatus, ConditionReport, PartsQuality } from '../../../src/types/index';
import { isNonEmptyString, sanitizeString, validateNumber } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole, sanitizeTechnicianForPublic, customerHasActiveJobWith, sanitizeQuoteForCustomer } from './shared';

/* -------------------------------------------------------------
 * 7. REPAIR JOBS & WORKFLOW (Strict Object-Level Authorization)
 * ----------------------------------------------------------- */
apiRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    const jobs = db.repairJobs.filter((j) => j.customerId === req.user!.id);
    return res.json(paginate(req, res, jobs));
  } else if (req.user!.role === 'technician') {
    const jobs = db.repairJobs.filter((j) => j.technicianId === req.user!.id);
    return res.json(paginate(req, res, jobs));
  }
  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.get('/jobs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  // Object-level ownership check
  if (req.user!.role === 'customer' && job.customerId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }
  if (req.user!.role === 'technician' && job.technicianId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  const customer = db.users.find((u) => u.id === job.customerId);
  let technician = db.technicianProfiles.find((t) => t.userId === job.technicianId || (t as any).id === job.technicianId);
  if (!technician && job.technicianId) {
    let u = db.users.find((u) => u.id === job.technicianId);
    if (!u) {
      u = {
        id: job.technicianId,
        email: `tech_${job.technicianId}@fixhub.local`,
        name: 'Fixhub Technician',
        phone: '',
        role: 'technician',
        createdAt: new Date().toISOString(),
        emailVerified: true,
        phoneVerified: false,
        passwordHash: '',
      };
      db.users.push(u);
    }
    technician = AuthService.ensureTechnicianProfile(u);
  }
  const payment = db.payments.find((p) => p.repairId === job.id);
  const quote = db.repairQuotes.find((q) => q.id === job.quoteId);

  const isOwnTechnician = req.user!.role === 'technician' && job.technicianId === req.user!.id;
  const revealPhone = req.user!.role === 'customer' && customerHasActiveJobWith(req.user!.id, job.technicianId);
  const safeTech = technician
    ? isOwnTechnician
      ? technician
      : revealPhone
        ? { ...sanitizeTechnicianForPublic(technician), phone: technician.phone }
        : sanitizeTechnicianForPublic(technician)
    : null;
  const safeQuote = quote && req.user!.role === 'customer' ? sanitizeQuoteForCustomer(quote, req.user!.id) : quote;

  return res.json({
    job,
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, avatarUrl: customer.avatarUrl } : null,
    technician: safeTech,
    payment,
    quote: safeQuote,
  });
});

apiRouter.post('/jobs/:id/check-in', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  if (job.technicianId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  // Job must currently be in BOOKED or DEVICE_DROPPED_OFF status
  if (job.status !== 'BOOKED' && job.status !== 'DEVICE_DROPPED_OFF') {
    return res.status(400).json({ error: `Cannot check in device: Job status is ${job.status}, expected BOOKED or DEVICE_DROPPED_OFF.` });
  }

  // Prevent duplicate check-in
  if (job.conditionReport) {
    return res.status(400).json({ error: 'Device has already been checked in.' });
  }

  const rawReport = req.body.report;
  if (!rawReport || typeof rawReport !== 'object') {
    return res.status(400).json({ error: 'Physical condition intake assessment report required.' });
  }

  const allowedFrontBack = ['PERFECT', 'MINOR_SCRATCHES', 'CRACKED', 'SHATTERED'] as const;
  const allowedFrame = ['PRISTINE', 'SCUFFED', 'BENT', 'DENTED'] as const;

  if (!rawReport.frontCondition || !allowedFrontBack.includes(rawReport.frontCondition)) {
    return res.status(400).json({ error: 'Valid front condition is required (PERFECT, MINOR_SCRATCHES, CRACKED, SHATTERED).' });
  }
  if (!rawReport.backCondition || !allowedFrontBack.includes(rawReport.backCondition)) {
    return res.status(400).json({ error: 'Valid back condition is required (PERFECT, MINOR_SCRATCHES, CRACKED, SHATTERED).' });
  }
  if (!rawReport.frameCondition || !allowedFrame.includes(rawReport.frameCondition)) {
    return res.status(400).json({ error: 'Valid frame condition is required (PRISTINE, SCUFFED, BENT, DENTED).' });
  }

  const conditionReport: ConditionReport = {
    timestamp: new Date().toISOString(),
    frontCondition: rawReport.frontCondition,
    backCondition: rawReport.backCondition,
    frameCondition: rawReport.frameCondition,
    screenPowersOn: Boolean(rawReport.screenPowersOn),
    touchResponsive: rawReport.touchResponsive !== undefined ? Boolean(rawReport.touchResponsive) : true,
    cameraWorking: rawReport.cameraWorking !== undefined ? Boolean(rawReport.cameraWorking) : true,
    existingDamageNotes: sanitizeString(rawReport.existingDamageNotes, 1000),
    accessoriesReceived: Array.isArray(rawReport.accessoriesReceived)
      ? rawReport.accessoriesReceived.filter((a): a is string => typeof a === 'string').map((a) => sanitizeString(a, 100))
      : [],
    photos: Array.isArray(rawReport.photos)
      ? rawReport.photos.filter((p): p is string => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:image/') || p.length > 0))
      : [],
    technicianNotes: sanitizeString(rawReport.technicianNotes, 1000),
    confirmedByCustomer: Boolean(rawReport.confirmedByCustomer),
  };

  const result = RepairWorkflowService.checkInDevice({
    jobId: req.params.id,
    technicianId: req.user!.id,
    report: conditionReport,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.patch('/jobs/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { newStatus, note } = req.body;
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Repair job not found.' });

  // Task 4: Explicit defensive protection against generic DEVICE_RECEIVED updates
  if (newStatus === 'DEVICE_RECEIVED') {
    return res.status(403).json({
      error: 'DEVICE_RECEIVED can only be created through the device check-in workflow.',
    });
  }

  // Ownership verification & role-based allowed transitions
  if (req.user!.role === 'technician') {
    if (job.technicianId !== req.user!.id) {
      return res.status(404).json({ error: 'Repair job not found.' });
    }

    // Task 1: Allowed technician statuses strictly limited to operational transitions
    const allowedTechStatuses: RepairLifecycleStatus[] = [
      'DIAGNOSING',
      'REPAIR_IN_PROGRESS',
      'READY_FOR_PICKUP',
    ];
    if (!allowedTechStatuses.includes(newStatus)) {
      return res.status(403).json({
        error: `Forbidden: Technicians cannot transition status to ${newStatus} via generic status update.`,
      });
    }
  } else if (req.user!.role === 'customer') {
    if (job.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Repair job not found.' });
    }

    // Task 6: Customers can only initiate legitimate customer handoff/pickup updates
    const allowedCustomerStatuses: RepairLifecycleStatus[] = [
      'DEVICE_DROPPED_OFF',
      'CANCELLED',
    ];
    if (!allowedCustomerStatuses.includes(newStatus)) {
      return res.status(403).json({
        error: `Forbidden: Customers cannot transition status to ${newStatus} directly.`,
      });
    }
  } else {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  // State machine transition verification
  const valid = RepairWorkflowService.isValidTransition(job.status, newStatus);
  if (!valid) {
    return res.status(400).json({
      error: `Invalid state transition from ${job.status} to ${newStatus}.`,
    });
  }

  const previousStatus = job.status;
  job.status = newStatus;
  const now = new Date().toISOString();

  if (newStatus === 'REPAIR_IN_PROGRESS' && !job.repairStartedAt) job.repairStartedAt = now;
  if (newStatus === 'READY_FOR_PICKUP') {
    job.readyForPickupAt = now;
    NotificationService.send({
      userId: job.customerId,
      title: 'Your Phone is Ready for Pickup!',
      message: `Repairs on your ${job.deviceBrand} ${job.deviceModel} are complete. Bring your pickup code (${job.pickupCode}) to the shop.`,
      type: 'STATUS_CHANGE',
      repairId: job.id,
    });
  }

  job.statusHistory.push({
    status: newStatus,
    timestamp: now,
    actorRole: req.user!.role,
    note: sanitizeString(note, 500) || `Status updated to ${newStatus}`,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: `STATUS_CHANGED_${newStatus}`,
    resourceType: 'REPAIR_JOB',
    resourceId: job.id,
    details: { previousStatus, newStatus, note: sanitizeString(note, 200) },
  });

  db.save();
  return res.json({ success: true, job });
});

apiRouter.post('/jobs/:id/add-part', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { partName, deviceModel, quality, priceNaira, warrantyDays, supplier, beforePhotoUrl, afterPhotoUrl } = req.body;

  if (!isNonEmptyString(partName)) {
    return res.status(400).json({ error: 'Part name is required.' });
  }

  const priceVal = validateNumber(priceNaira, 'Part price', { min: 0, max: 10_000_000 });
  if (priceVal.valid === false) return res.status(400).json({ error: priceVal.error });

  const warrantyVal = validateNumber(warrantyDays || 60, 'Warranty days', { min: 0, max: 365, integerOnly: true });
  if (warrantyVal.valid === false) return res.status(400).json({ error: warrantyVal.error });

  const allowedQualities: PartsQuality[] = [
    'ORIGINAL_OEM',
    'PREMIUM_AFTERMARKET',
    'STANDARD_AFTERMARKET',
    'REFURBISHED',
  ];
  const resolvedQuality: PartsQuality = allowedQualities.includes(quality) ? quality : 'PREMIUM_AFTERMARKET';

  const result = RepairWorkflowService.addPartUsed({
    jobId: req.params.id,
    technicianId: req.user!.id,
    part: {
      partName: sanitizeString(partName, 120),
      deviceModel: sanitizeString(deviceModel, 80) || 'Standard',
      quality: resolvedQuality,
      priceNaira: priceVal.value,
      warrantyDays: warrantyVal.value,
      supplier: supplier ? sanitizeString(supplier, 120) : undefined,
      beforePhotoUrl: beforePhotoUrl ? sanitizeString(beforePhotoUrl, 500) : undefined,
      afterPhotoUrl: afterPhotoUrl ? sanitizeString(afterPhotoUrl, 500) : undefined,
    },
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/jobs/:id/additional-diagnosis', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { title, description, additionalCostNaira, photoEvidence } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ error: 'Title is required for additional diagnosis.' });
  }

  const costVal = validateNumber(additionalCostNaira, 'Additional cost', { min: 0, max: 10_000_000 });
  if (costVal.valid === false) return res.status(400).json({ error: costVal.error });

  const result = RepairWorkflowService.submitAdditionalDiagnosis({
    jobId: req.params.id,
    technicianId: req.user!.id,
    title: sanitizeString(title, 150),
    description: sanitizeString(description, 1500),
    additionalCostNaira: costVal.value,
    photoEvidence: Array.isArray(photoEvidence) ? photoEvidence.filter((p) => typeof p === 'string') : [],
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/jobs/:id/additional-diagnosis/respond', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { approved, reason } = req.body;
  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'Field "approved" (boolean) is required.' });
  }

  const result = RepairWorkflowService.respondToAdditionalDiagnosis({
    jobId: req.params.id,
    customerId: req.user!.id,
    approved,
    reason: reason ? sanitizeString(reason, 300) : undefined,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/jobs/:id/verify-dropoff', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { dropOffCode } = req.body;
  if (!isNonEmptyString(dropOffCode)) {
    return res.status(400).json({ error: 'Customer drop-off code is required.' });
  }

  const result = RepairWorkflowService.verifyDropOff({
    jobId: req.params.id,
    technicianId: req.user!.id,
    dropOffCode: sanitizeString(dropOffCode, 30),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/jobs/:id/verify-pickup', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { pickupCode } = req.body;
  if (!isNonEmptyString(pickupCode)) {
    return res.status(400).json({ error: 'Customer pickup code is required.' });
  }

  const result = RepairWorkflowService.verifyPickup({
    jobId: req.params.id,
    technicianId: req.user!.id,
    pickupCode: sanitizeString(pickupCode, 30),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/jobs/:id/confirm-completion', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const result = RepairWorkflowService.confirmCompletion({
    jobId: req.params.id,
    customerId: req.user!.id,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/jobs/:id/dispute', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'Dispute reason is required.' });
  }

  const result = RepairWorkflowService.disputeJob({
    jobId: req.params.id,
    actorId: req.user!.id,
    actorRole: req.user!.role,
    reason: sanitizeString(reason, 1000),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/jobs/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const result = await RepairWorkflowService.cancelJob({
    jobId: req.params.id,
    actorId: req.user!.id,
    actorRole: req.user!.role,
    reason: reason ? sanitizeString(reason, 500) : undefined,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

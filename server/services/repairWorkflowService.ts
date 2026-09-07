import { db } from '../db';
import {
  RepairLifecycleStatus,
  UserRole,
  RepairJob,
  RepairRequest,
  ConditionReport,
  PartUsedRecord,
  AdditionalDiagnosis,
  WarrantyRecord,
} from '../../src/types/index';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { PaymentService } from './paymentService';
import { QuoteAccuracyService } from './quoteAccuracyService';

const ALLOWED_TRANSITIONS: Record<RepairLifecycleStatus, RepairLifecycleStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['MATCHING', 'QUOTING', 'CANCELLED'],
  MATCHING: ['TECHNICIANS_FOUND', 'QUOTING', 'CANCELLED'],
  TECHNICIANS_FOUND: ['QUOTING', 'QUOTE_ACCEPTED', 'CANCELLED'],
  REQUESTED: ['MATCHING', 'QUOTING', 'CANCELLED'],
  QUOTING: ['QUOTE_ACCEPTED', 'PAYMENT_PENDING', 'CANCELLED'],
  QUOTE_RECEIVED: ['QUOTE_ACCEPTED', 'CANCELLED'],
  QUOTE_ACCEPTED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['BOOKED', 'CANCELLED', 'REFUNDED'],
  BOOKED: ['DEVICE_RECEIVED', 'DEVICE_DROPPED_OFF', 'CANCELLED'],
  DEVICE_DROPPED_OFF: ['DEVICE_RECEIVED', 'CANCELLED'],
  DEVICE_RECEIVED: ['DIAGNOSING', 'REPAIR_IN_PROGRESS', 'DISPUTED'],
  DIAGNOSING: ['REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'DISPUTED'],
  IN_REPAIR: ['READY_FOR_PICKUP', 'ADDITIONAL_DIAGNOSIS', 'DISPUTED'],
  ADDITIONAL_DIAGNOSIS: ['REPAIR_IN_PROGRESS', 'CANCELLED', 'DISPUTED'],
  REPAIR_IN_PROGRESS: ['READY_FOR_PICKUP', 'ADDITIONAL_DIAGNOSIS', 'DISPUTED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'COMPLETED', 'DISPUTED'],
  PICKED_UP: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  REPAIR_COMPLETED: ['COMPLETED'],
  DISPUTED: ['COMPLETED', 'REFUNDED', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
};

export class RepairWorkflowService {
  /**
   * Validates whether transition from current status to next status is permitted
   */
  public static isValidTransition(current: RepairLifecycleStatus, next: RepairLifecycleStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  /**
   * Accepts a quote, builds the RepairJob, and puts it in PAYMENT_PENDING
   */
  public static acceptQuote(params: {
    requestId: string;
    quoteId: string;
    customerId: string;
  }): { job: RepairJob } | { error: string } {
    const { requestId, quoteId, customerId } = params;

    const request = db.repairRequests.find((r) => r.id === requestId);
    if (!request) return { error: 'Repair request not found.' };
    if (request.customerId !== customerId) return { error: 'Unauthorized: Request does not belong to you.' };

    if (request.status !== 'REQUESTED' && request.status !== 'QUOTING') {
      return { error: `Request is no longer open for quote acceptance (current status: ${request.status}).` };
    }

    const quote = db.repairQuotes.find((q) => q.id === quoteId && q.requestId === requestId);
    if (!quote) return { error: 'Quote not found for this request.' };
    if (quote.status !== 'PENDING') {
      return { error: `Quote is no longer available (current status: ${quote.status}).` };
    }

    const tech = db.technicianProfiles.find((t) => t.userId === quote.technicianId);
    if (!tech) return { error: 'Technician profile associated with quote not found.' };

    quote.status = 'ACCEPTED';
    request.selectedQuoteId = quoteId;
    request.selectedTechnicianId = quote.technicianId;
    request.status = 'QUOTE_ACCEPTED';
    request.updatedAt = new Date().toISOString();

    // Mark other quotes for this request as REJECTED
    db.repairQuotes
      .filter((q) => q.requestId === requestId && q.id !== quoteId)
      .forEach((q) => {
        q.status = 'REJECTED';
      });

    // Generate 6-digit verification codes
    const dropOffCode = `FX-${Math.floor(1000 + Math.random() * 9000)}`;
    const pickupCode = `PK-${Math.floor(1000 + Math.random() * 9000)}`;
    const handoffQrToken = `tok_fixhub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const total = quote.totalAmount;
    const platformFee = Math.round(total * 0.085);
    const techPayout = total - platformFee;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const bookingRef = `FH-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    const job: RepairJob = {
      id: jobId,
      bookingRef,
      requestId: request.id,
      quoteId: quote.id,
      customerId: request.customerId,
      technicianId: quote.technicianId,
      deviceBrand: request.deviceBrand,
      deviceModel: request.deviceModel,
      issues: request.issues,
      status: 'PAYMENT_PENDING',
      dropOffCode,
      pickupCode,
      handoffQrToken,
      originalQuoteAmount: total,
      finalAmount: total,
      platformFeeAmount: platformFee,
      technicianPayoutAmount: techPayout,
      partsUsed: [],
      createdAt: now,
      statusHistory: [
        { status: 'REQUESTED', timestamp: request.createdAt, actorRole: 'customer' },
        { status: 'QUOTING', timestamp: quote.createdAt, actorRole: 'technician' },
        { status: 'QUOTE_ACCEPTED', timestamp: now, actorRole: 'customer', note: `Accepted quote from ${quote.technicianName} (₦${total.toLocaleString()})` },
        { status: 'PAYMENT_PENDING', timestamp: now, actorRole: 'customer' },
      ],
    };

    db.repairJobs.push(job);

    NotificationService.send({
      userId: quote.technicianId,
      title: 'Quote Accepted!',
      message: `${request.customerName} accepted your quote of ₦${total.toLocaleString()} for ${request.deviceBrand} ${request.deviceModel}. Waiting for escrow payment.`,
      type: 'QUOTE',
      repairId: job.id,
    });

    AuditService.log({
      actorId: customerId,
      actorRole: 'customer',
      action: 'QUOTE_ACCEPTED',
      resourceType: 'REPAIR_JOB',
      resourceId: jobId,
      details: { quoteId, totalAmount: total },
    });

    db.save();
    return { job };
  }

  /**
   * Device Check-in by Technician at shop
   * Dedicated workflow: ONLY valid path to transition BOOKED -> DEVICE_RECEIVED
   */
  public static checkInDevice(params: {
    jobId: string;
    technicianId: string;
    report: ConditionReport;
  }): { success: boolean; job?: RepairJob; error?: string } {
    const { jobId, technicianId, report } = params;
    const job = db.repairJobs.find((j) => j.id === jobId);
    if (!job) {
      return { success: false, error: 'Job not found.' };
    }
    if (job.technicianId !== technicianId) {
      return { success: false, error: 'Unauthorized: Not your assigned repair job.' };
    }

    // Duplicate check-in rejection
    if (job.conditionReport || job.status === 'DEVICE_RECEIVED' || ['DIAGNOSING', 'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].includes(job.status)) {
      return { success: false, error: 'Device has already been checked in.' };
    }

    // Must be strictly BOOKED (or DEVICE_DROPPED_OFF)
    if (job.status !== 'BOOKED' && job.status !== 'DEVICE_DROPPED_OFF') {
      return { success: false, error: `Cannot check in device: Job status is ${job.status}, expected BOOKED.` };
    }

    // Validate state machine transition
    if (!this.isValidTransition(job.status, 'DEVICE_RECEIVED')) {
      return { success: false, error: `Invalid transition from ${job.status} to DEVICE_RECEIVED.` };
    }

    // Validate condition report structure
    if (!report || typeof report !== 'object') {
      return { success: false, error: 'Physical condition intake assessment report is required.' };
    }

    const allowedFrontBack = ['PERFECT', 'MINOR_SCRATCHES', 'CRACKED', 'SHATTERED'];
    const allowedFrame = ['PRISTINE', 'SCUFFED', 'BENT', 'DENTED'];

    if (!report.frontCondition || !allowedFrontBack.includes(report.frontCondition)) {
      return { success: false, error: 'Valid front physical condition is required (PERFECT, MINOR_SCRATCHES, CRACKED, SHATTERED).' };
    }
    if (!report.backCondition || !allowedFrontBack.includes(report.backCondition)) {
      return { success: false, error: 'Valid back physical condition is required (PERFECT, MINOR_SCRATCHES, CRACKED, SHATTERED).' };
    }
    if (!report.frameCondition || !allowedFrame.includes(report.frameCondition)) {
      return { success: false, error: 'Valid frame condition is required (PRISTINE, SCUFFED, BENT, DENTED).' };
    }

    const now = new Date().toISOString();
    const previousStatus = job.status;

    // Sanitize and ensure server-side timestamp
    const sanitizedReport: ConditionReport = {
      timestamp: now,
      frontCondition: report.frontCondition,
      backCondition: report.backCondition,
      frameCondition: report.frameCondition,
      screenPowersOn: Boolean(report.screenPowersOn),
      touchResponsive: report.touchResponsive !== undefined ? Boolean(report.touchResponsive) : true,
      cameraWorking: report.cameraWorking !== undefined ? Boolean(report.cameraWorking) : true,
      existingDamageNotes: typeof report.existingDamageNotes === 'string' ? report.existingDamageNotes.trim().slice(0, 1000) : '',
      accessoriesReceived: Array.isArray(report.accessoriesReceived)
        ? report.accessoriesReceived.filter((a): a is string => typeof a === 'string').map((a) => a.trim().slice(0, 100))
        : [],
      photos: Array.isArray(report.photos)
        ? report.photos.filter((p): p is string => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:image/') || p.length > 0))
        : [],
      technicianNotes: typeof report.technicianNotes === 'string' ? report.technicianNotes.trim().slice(0, 1000) : '',
      confirmedByCustomer: Boolean(report.confirmedByCustomer),
    };

    job.conditionReport = sanitizedReport;
    job.status = 'DEVICE_RECEIVED';
    job.receivedAt = now;
    job.statusHistory.push({
      status: 'DEVICE_RECEIVED',
      timestamp: now,
      actorRole: 'technician',
      note: 'Device checked in and physical intake condition report recorded.',
    });

    NotificationService.send({
      userId: job.customerId,
      title: 'Phone Checked In at Shop',
      message: `Your ${job.deviceBrand} ${job.deviceModel} has been received and verified by the technician. Digital check-in report is ready to view.`,
      type: 'STATUS_CHANGE',
      repairId: job.id,
    });

    AuditService.log({
      actorId: technicianId,
      actorRole: 'technician',
      action: 'DEVICE_CHECKED_IN',
      resourceType: 'REPAIR_JOB',
      resourceId: jobId,
      details: {
        previousStatus,
        newStatus: 'DEVICE_RECEIVED',
        frontCondition: sanitizedReport.frontCondition,
        backCondition: sanitizedReport.backCondition,
        frameCondition: sanitizedReport.frameCondition,
        screenPowersOn: sanitizedReport.screenPowersOn,
        intakeTimestamp: now,
      },
    });

    db.save();
    return { success: true, job };
  }

  /**
   * Record part used in repair
   */
  public static addPartUsed(params: {
    jobId: string;
    technicianId: string;
    part: Omit<PartUsedRecord, 'id' | 'installationTimestamp'>;
  }): { success: boolean; partRecord?: PartUsedRecord; error?: string } {
    const { jobId, technicianId, part } = params;
    const job = db.repairJobs.find((j) => j.id === jobId);
    if (!job) return { success: false, error: 'Job not found.' };
    if (job.technicianId !== technicianId) return { success: false, error: 'Unauthorized.' };

    if (!['DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS'].includes(job.status)) {
      return { success: false, error: `Cannot record parts when job status is ${job.status}.` };
    }

    const partRecord: PartUsedRecord = {
      id: `partrec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...part,
      installationTimestamp: new Date().toISOString(),
    };

    job.partsUsed.push(partRecord);

    AuditService.log({
      actorId: technicianId,
      actorRole: 'technician',
      action: 'PART_RECORDED',
      resourceType: 'REPAIR_JOB',
      resourceId: jobId,
      details: { partName: part.partName, quality: part.quality, priceNaira: part.priceNaira },
    });

    db.save();
    return { success: true, partRecord };
  }

  /**
   * Submit Additional Diagnosis
   */
  public static submitAdditionalDiagnosis(params: {
    jobId: string;
    technicianId: string;
    title: string;
    description: string;
    additionalCostNaira: number;
    photoEvidence: string[];
  }): { success: boolean; diagnosis?: AdditionalDiagnosis; error?: string } {
    const { jobId, technicianId, title, description, additionalCostNaira, photoEvidence } = params;
    const job = db.repairJobs.find((j) => j.id === jobId);
    if (!job) return { success: false, error: 'Job not found.' };
    if (job.technicianId !== technicianId) return { success: false, error: 'Unauthorized.' };

    if (!['DEVICE_RECEIVED', 'DIAGNOSING', 'REPAIR_IN_PROGRESS'].includes(job.status)) {
      return { success: false, error: `Cannot submit additional diagnosis when job status is ${job.status}.` };
    }

    const isMinor = QuoteAccuracyService.isMinorVariation(job.originalQuoteAmount, additionalCostNaira);
    const newTotal = job.originalQuoteAmount + additionalCostNaira;

    const diagnosis: AdditionalDiagnosis = {
      id: `diag_${Date.now()}`,
      discoveredAt: new Date().toISOString(),
      title,
      description,
      photoEvidence,
      additionalCostNaira,
      newTotalAmountNaira: newTotal,
      isMinorAutoApproved: isMinor,
      status: isMinor ? 'APPROVED' : 'PENDING_APPROVAL',
      resolvedAt: isMinor ? new Date().toISOString() : undefined,
    };

    job.additionalDiagnosis = diagnosis;

    if (isMinor) {
      job.finalAmount = newTotal;
      job.platformFeeAmount = Math.round(newTotal * 0.085);
      job.technicianPayoutAmount = newTotal - job.platformFeeAmount;
    } else {
      job.status = 'ADDITIONAL_DIAGNOSIS';
      job.statusHistory.push({
        status: 'ADDITIONAL_DIAGNOSIS',
        timestamp: new Date().toISOString(),
        actorRole: 'technician',
        note: `Additional issue discovered (+₦${additionalCostNaira.toLocaleString()}). Awaiting customer approval.`,
      });

      NotificationService.send({
        userId: job.customerId,
        title: 'Action Required: Additional Diagnosis',
        message: `Technician discovered: "${title}" (+₦${additionalCostNaira.toLocaleString()}). Tap to review photo evidence and approve/decline.`,
        type: 'STATUS_CHANGE',
        repairId: job.id,
      });
    }

    AuditService.log({
      actorId: technicianId,
      actorRole: 'technician',
      action: 'ADDITIONAL_DIAGNOSIS_SUBMITTED',
      resourceType: 'REPAIR_JOB',
      resourceId: jobId,
      details: { title, additionalCostNaira, isMinorAutoApproved: isMinor },
    });

    db.save();
    return { success: true, diagnosis };
  }

  /**
   * Customer confirms pickup and repair completion
   */
  public static confirmCompletion(params: {
    jobId: string;
    customerId: string;
  }): { success: boolean; warranty?: WarrantyRecord; error?: string } {
    const { jobId, customerId } = params;
    const job = db.repairJobs.find((j) => j.id === jobId);
    if (!job) return { success: false, error: 'Job not found.' };
    if (job.customerId !== customerId) return { success: false, error: 'Unauthorized: Repair job does not belong to you.' };

    if (job.status === 'COMPLETED') {
      return { success: false, error: 'Repair job is already completed.' };
    }

    if (job.status !== 'READY_FOR_PICKUP' && job.status !== 'PICKED_UP') {
      return { success: false, error: `Cannot confirm completion when job is in status ${job.status}. Must be READY_FOR_PICKUP or PICKED_UP.` };
    }

    const now = new Date().toISOString();
    job.status = 'COMPLETED';
    job.completedAt = now;
    job.statusHistory.push({
      status: 'COMPLETED',
      timestamp: now,
      actorRole: 'customer',
      note: 'Customer inspected device and confirmed repair completion.',
    });

    // Create & Activate Warranty
    const quote = db.repairQuotes.find((q) => q.id === job.quoteId);
    const tech = db.technicianProfiles.find((t) => t.userId === job.technicianId);
    const periodDays = quote?.warrantyDays || 60;
    const endDate = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    const warranty: WarrantyRecord = {
      id: `war_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      repairJobId: job.id,
      deviceBrand: job.deviceBrand,
      deviceModel: job.deviceModel,
      coveredRepair: (job.issues || []).join(', '),
      coveredRepairs: job.issues && job.issues.length > 0 ? job.issues : ['Standard Repair Service'],
      technicianId: job.technicianId,
      technicianName: tech ? tech.businessName : 'Certified Technician',
      periodDays,
      startDate: now,
      endDate,
      terms: `Covers parts and workmanship defects for ${periodDays} days. Excludes physical drop impact or water immersion after repair date.`,
      status: 'ACTIVE',
    };

    job.warranty = warranty;
    db.warranties.push(warranty);

    // Release Escrow funds
    PaymentService.releaseTechnicianFunds({
      repairJobId: job.id,
      actorId: customerId,
      actorRole: 'customer',
    });

    // Evaluate quote accuracy & update metrics
    QuoteAccuracyService.evaluateJobCompletion({
      technicianId: job.technicianId,
      originalQuoteAmount: job.originalQuoteAmount,
      finalAmount: job.finalAmount,
      repairJobId: job.id,
    });

    // Update technician completed jobs count
    if (tech) {
      tech.completedJobs = (tech.completedJobs || 0) + 1;
    }

    // Update customer total repairs count
    const custProfile = db.customerProfiles.find((c) => c.userId === customerId);
    if (custProfile) {
      custProfile.totalRepairsCount = (custProfile.totalRepairsCount || 0) + 1;
      custProfile.activeRepairsCount = Math.max(0, (custProfile.activeRepairsCount || 1) - 1);
    }

    NotificationService.send({
      userId: job.customerId,
      title: 'Warranty Activated & Repair Complete!',
      message: `Your ${periodDays}-day Fix Hub Warranty for ${job.deviceBrand} ${job.deviceModel} is now active. You can rate your technician.`,
      type: 'WARRANTY',
      repairId: job.id,
    });

    AuditService.log({
      actorId: customerId,
      actorRole: 'customer',
      action: 'REPAIR_COMPLETED_AND_CONFIRMED',
      resourceType: 'REPAIR_JOB',
      resourceId: jobId,
      details: { warrantyId: warranty.id, finalAmount: job.finalAmount },
    });

    db.save();
    return { success: true, warranty };
  }
}

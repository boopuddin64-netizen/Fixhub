import { db } from '../db';
import {
  PaymentTransaction,
  TechnicianEarnings,
  PayoutRecord,
  RefundRecord,
  UserRole,
  WebhookEventRecord,
} from '../../src/types/index';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { PaystackClient } from './paystackClient';

export interface InitializePaymentParams {
  repairJobId: string;
  customerId: string;
  idempotencyKey: string;
  paymentMethod?: 'CARD' | 'BANK_TRANSFER' | 'USSD';
  customerEmail?: string;
}

export interface VerifyPaymentParams {
  reference: string;
  paymentId?: string;
  actorId?: string;
  actorRole?: UserRole;
}

export class PaymentService {
  /**
   * Platform commission percentage (defaults to 8.5%)
   */
  public static get COMMISSION_RATE(): number {
    const raw = process.env.PLATFORM_COMMISSION_PERCENT || '8.5';
    const parsed = Number(raw);
    return isNaN(parsed) || parsed < 0 ? 0.085 : parsed / 100;
  }

  /**
   * Helper to calculate platform commission and net technician earnings in integer Naira.
   */
  public static calculatePlatformDeduction(grossAmountNaira: number): {
    grossAmountNaira: number;
    platformFeeNaira: number;
    netEarningsNaira: number;
  } {
    const platformFeeNaira = Math.round(grossAmountNaira * this.COMMISSION_RATE);
    const netEarningsNaira = Math.max(0, grossAmountNaira - platformFeeNaira);
    return { grossAmountNaira, platformFeeNaira, netEarningsNaira };
  }

  /**
   * Initializes a Paystack transaction for a repair job.
   * Authoritative amount is derived strictly from server-side quote and job records.
   */
  public static async initializePayment(params: InitializePaymentParams): Promise<
    | {
        success: true;
        payment: PaymentTransaction;
        authorizationUrl?: string;
        accessCode?: string;
        reference: string;
        isExisting: boolean;
      }
    | { success: false; error: string }
  > {
    const { repairJobId, customerId, idempotencyKey, paymentMethod = 'CARD' } = params;

    // 1. Authenticate & verify repair job ownership
    const job = db.repairJobs.find((j) => j.id === repairJobId);
    if (!job) {
      return { success: false, error: 'Repair job not found.' };
    }

    if (job.customerId !== customerId) {
      return { success: false, error: 'Unauthorized: You cannot pay for another customer’s repair.' };
    }

    // 2. Verify accepted quote exists
    const quote = db.repairQuotes.find((q) => q.id === job.quoteId);
    if (!quote) {
      return { success: false, error: 'Accepted quote not found for this repair booking.' };
    }

    // 3. Verify job is in PAYMENT_PENDING state or allow retry if previous payment failed/cancelled
    if (job.status !== 'PAYMENT_PENDING' && job.status !== 'REQUESTED') {
      const existingSuccess = db.payments.find(
        (p) => p.repairId === repairJobId && (p.status === 'SUCCESS' || p.status === 'ESCROW_HELD')
      );
      if (existingSuccess) {
        return { success: false, error: 'This repair job has already been paid for and confirmed.' };
      }
    }

    // 4. Verify no successful payment already exists
    const alreadyPaid = db.payments.find(
      (p) => p.repairId === repairJobId && (p.status === 'SUCCESS' || p.status === 'ESCROW_HELD')
    );
    if (alreadyPaid) {
      return {
        success: true,
        payment: alreadyPaid,
        reference: alreadyPaid.providerReference || alreadyPaid.transactionRef,
        isExisting: true,
      };
    }

    // 5. Idempotency Check: if identical idempotency key exists, reuse initiated transaction
    const existingAttempt = db.payments.find(
      (p) =>
        p.idempotencyKey === idempotencyKey &&
        p.repairId === repairJobId &&
        (p.status === 'INITIATED' || p.status === 'PENDING')
    );
    if (existingAttempt) {
      return {
        success: true,
        payment: existingAttempt,
        authorizationUrl: existingAttempt.authorizationUrl,
        accessCode: existingAttempt.accessCode,
        reference: existingAttempt.providerReference || existingAttempt.transactionRef,
        isExisting: true,
      };
    }

    // 6. Obtain authoritative amount from server record (Never trust client!)
    const totalAmount = job.finalAmount || job.originalQuoteAmount || quote.totalAmount;
    if (!totalAmount || totalAmount <= 0) {
      return { success: false, error: 'Invalid repair job total amount.' };
    }

    // Commission calculations (Integer Naira)
    const platformFee = Math.round(totalAmount * this.COMMISSION_RATE);
    const technicianPayout = totalAmount - platformFee;

    // 7. Generate safe, unique transaction reference
    const now = new Date();
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const uniqueRef = `FXP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 8. Resolve customer email for Paystack
    const customer = db.users.find((u) => u.id === customerId);
    const email = params.customerEmail || customer?.email || `customer_${customerId}@fixhub.ng`;

    // 9. Initialize Paystack transaction server-side
    const paystackRes = await PaystackClient.initializeTransaction({
      email,
      amountKobo: totalAmount * 100,
      reference: uniqueRef,
      callbackUrl: `${process.env.APP_URL || 'http://localhost:3000'}/payment/callback?reference=${encodeURIComponent(uniqueRef)}`,
      metadata: {
        repairJobId,
        customerId,
        technicianId: job.technicianId,
        quoteId: quote.id,
        platformFeeNaira: platformFee,
        technicianPayoutNaira: technicianPayout,
      },
    });

    if (!paystackRes.success) {
      return { success: false, error: paystackRes.error || 'Failed to initialize Paystack transaction.' };
    }

    // 10. Record payment transaction in database
    const payment: PaymentTransaction = {
      id: paymentId,
      repairId: repairJobId,
      customerId,
      technicianId: job.technicianId,
      quoteId: quote.id,
      amountNaira: totalAmount,
      platformFeeNaira: platformFee,
      technicianPayoutNaira: technicianPayout,
      currency: 'NGN',
      provider: process.env.PAYMENT_MODE === 'live' ? 'PAYSTACK_LIVE' : 'PAYSTACK_SANDBOX',
      status: 'INITIATED',
      transactionRef: uniqueRef,
      providerReference: uniqueRef,
      idempotencyKey,
      paymentMethod,
      authorizationUrl: paystackRes.authorizationUrl,
      accessCode: paystackRes.accessCode,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    db.payments.push(payment);
    db.save();

    AuditService.log({
      actorId: customerId,
      actorRole: 'customer',
      action: 'PAYMENT_INITIALIZED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      details: {
        amountNaira: totalAmount,
        platformFeeNaira: platformFee,
        technicianPayoutNaira: technicianPayout,
        repairJobId,
        reference: uniqueRef,
      },
    });

    NotificationService.send({
      userId: customerId,
      title: 'Payment Initialized',
      message: `Payment of ₦${totalAmount.toLocaleString()} initiated for ${job.deviceBrand} ${job.deviceModel} repair.`,
      type: 'PAYMENT',
      repairId: job.id,
    });

    return {
      success: true,
      payment,
      authorizationUrl: paystackRes.authorizationUrl,
      accessCode: paystackRes.accessCode,
      reference: uniqueRef,
      isExisting: false,
    };
  }

  /**
   * Server-side verification of payment with Paystack.
   * Enforces amount integrity, currency integrity, object ownership, and idempotency.
   */
  public static async verifyPayment(params: VerifyPaymentParams): Promise<{
    success: boolean;
    payment?: PaymentTransaction;
    alreadyVerified?: boolean;
    error?: string;
  }> {
    const { reference, paymentId, actorId, actorRole } = params;

    // 1. Locate payment record
    const payment = db.payments.find(
      (p) =>
        (reference && (p.providerReference === reference || p.transactionRef === reference)) ||
        (paymentId && p.id === paymentId)
    );

    if (!payment) {
      return { success: false, error: 'Payment transaction record not found.' };
    }

    // 2. Authorization check: customer can only verify their own payment
    if (actorRole === 'customer' && actorId && payment.customerId !== actorId) {
      return { success: false, error: 'Unauthorized: Payment does not belong to you.' };
    }

    // 3. Locate associated job
    const job = db.repairJobs.find((j) => j.id === payment.repairId);
    if (!job) {
      return { success: false, error: 'Associated repair job not found.' };
    }

    if (actorRole === 'customer' && actorId && job.customerId !== actorId) {
      return { success: false, error: 'Unauthorized: Repair job does not belong to you.' };
    }

    // 4. Idempotency check: if already confirmed, safely return existing verified record
    if (payment.status === 'SUCCESS' || payment.status === 'ESCROW_HELD') {
      return { success: true, payment, alreadyVerified: true };
    }

    // 5. Server-side verification with Paystack
    const expectedKobo = payment.amountNaira * 100;
    const verifyResult = await PaystackClient.verifyTransaction(
      payment.providerReference || payment.transactionRef,
      expectedKobo
    );

    if (!verifyResult.status || !verifyResult.data) {
      payment.status = 'FAILED';
      payment.failedAt = new Date().toISOString();
      payment.failureReason = verifyResult.message || 'Verification rejected by Paystack.';
      db.save();

      AuditService.log({
        actorId: actorId || payment.customerId,
        actorRole: actorRole || 'customer',
        action: 'PAYMENT_FAILED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: { reference: payment.transactionRef, reason: payment.failureReason },
      });

      NotificationService.send({
        userId: payment.customerId,
        title: 'Payment Failed',
        message: `Your payment of ₦${payment.amountNaira.toLocaleString()} could not be confirmed. You may retry checkout.`,
        type: 'PAYMENT',
        repairId: job.id,
      });

      return { success: false, error: 'Payment could not be confirmed.' };
    }

    const providerData = verifyResult.data;

    // 6. Provider status verification
    if (providerData.status !== 'success') {
      payment.status = 'FAILED';
      payment.failedAt = new Date().toISOString();
      payment.failureReason = providerData.gateway_response || 'Payment was not marked successful by provider.';
      db.save();

      AuditService.log({
        actorId: actorId || payment.customerId,
        actorRole: actorRole || 'customer',
        action: 'PAYMENT_FAILED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: { reference: payment.transactionRef, gatewayResponse: providerData.gateway_response },
      });

      return { success: false, error: 'Payment could not be confirmed.' };
    }

    // 7. FINANCIAL INTEGRITY BOUNDARY: Amount check (Never trust provider blindly)
    if (providerData.amount !== expectedKobo) {
      payment.status = 'FAILED';
      payment.failedAt = new Date().toISOString();
      payment.failureReason = `Amount mismatch: Expected ₦${payment.amountNaira} (${expectedKobo} kobo), received ${providerData.amount} kobo.`;
      db.save();

      AuditService.log({
        actorId: actorId || payment.customerId,
        actorRole: actorRole || 'customer',
        action: 'PAYMENT_AMOUNT_MISMATCH_REJECTED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: {
          expectedAmountKobo: expectedKobo,
          receivedAmountKobo: providerData.amount,
        },
      });

      return { success: false, error: 'Payment amount mismatch. Verification rejected.' };
    }

    // 8. FINANCIAL INTEGRITY BOUNDARY: Currency check
    if (providerData.currency && providerData.currency.toUpperCase() !== 'NGN') {
      payment.status = 'FAILED';
      payment.failedAt = new Date().toISOString();
      payment.failureReason = `Currency mismatch: Expected NGN, received ${providerData.currency}.`;
      db.save();

      return { success: false, error: 'Payment currency mismatch. Verification rejected.' };
    }

    // 9. Payment Confirmation State Transitions
    const paidAt = providerData.paid_at || new Date().toISOString();
    payment.status = 'SUCCESS';
    payment.paidAt = paidAt;
    payment.channel = providerData.channel || payment.paymentMethod;
    payment.updatedAt = paidAt;

    // Update Repair Job state to BOOKED with explicit history entry
    job.status = 'BOOKED';
    job.bookedAt = paidAt;
    job.statusHistory.push({
      status: 'PAYMENT_CONFIRMED',
      timestamp: paidAt,
      actorRole: 'customer',
      note: `Payment of ₦${payment.amountNaira.toLocaleString()} confirmed via Paystack (Ref: ${payment.transactionRef}).`,
    });
    job.statusHistory.push({
      status: 'BOOKED',
      timestamp: paidAt,
      actorRole: 'customer',
      note: 'Repair booking confirmed. Awaiting physical device check-in.',
    });

    // Update parent Repair Request
    const request = db.repairRequests.find((r) => r.id === job.requestId);
    if (request) {
      request.status = 'BOOKED';
      request.updatedAt = paidAt;
    }

    // 10. Financial Ledger: Create Technician Earnings record in HELD status
    let earnings = db.technicianEarnings.find((e) => e.paymentId === payment.id);
    if (!earnings) {
      const earningsId = `earn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      earnings = {
        id: earningsId,
        technicianId: job.technicianId,
        repairId: job.id,
        paymentId: payment.id,
        grossAmountNaira: payment.amountNaira,
        platformFeeNaira: payment.platformFeeNaira,
        netEarningsNaira: payment.technicianPayoutNaira,
        commissionPercent: Math.round(this.COMMISSION_RATE * 1000) / 10,
        status: 'HELD',
        createdAt: paidAt,
        updatedAt: paidAt,
      };
      db.technicianEarnings.push(earnings);
    }

    // 11. Audit Logging
    AuditService.log({
      actorId: actorId || payment.customerId,
      actorRole: actorRole || 'customer',
      action: 'PAYMENT_VERIFIED',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      details: {
        amountNaira: payment.amountNaira,
        platformFeeNaira: payment.platformFeeNaira,
        technicianPayoutNaira: payment.technicianPayoutNaira,
        providerReference: payment.providerReference,
        status: 'SUCCESS',
      },
    });

    AuditService.log({
      actorId: 'system',
      actorRole: 'admin',
      action: 'EARNINGS_CREATED',
      resourceType: 'EARNINGS',
      resourceId: earnings.id,
      details: {
        technicianId: job.technicianId,
        netEarningsNaira: payment.technicianPayoutNaira,
        status: 'HELD',
      },
    });

    // 12. Notifications (Accurate, transparent language)
    NotificationService.send({
      userId: payment.customerId,
      title: 'Payment Confirmed',
      message: `Your payment of ₦${payment.amountNaira.toLocaleString()} is confirmed. Your booking (Ref: ${job.bookingRef || job.id}) is active.`,
      type: 'PAYMENT',
      repairId: job.id,
    });

    NotificationService.send({
      userId: job.technicianId,
      title: 'Repair Booking Confirmed',
      message: `Customer confirmed payment of ₦${payment.amountNaira.toLocaleString()} for ${job.deviceBrand} ${job.deviceModel}. Estimated net earnings: ₦${payment.technicianPayoutNaira.toLocaleString()} (Held pending completion).`,
      type: 'PAYMENT',
      repairId: job.id,
    });

    db.save();
    return { success: true, payment };
  }

  /**
   * Processes an incoming Paystack Webhook with HMAC SHA512 signature validation and strict idempotency.
   */
  public static async processWebhook(params: {
    rawBody: Buffer | string | undefined;
    signatureHeader: string | undefined;
    eventPayload: any;
  }): Promise<{ success: boolean; statusCode: number; message: string; eventId?: string }> {
    const { rawBody, signatureHeader, eventPayload } = params;

    // 1. Verify Webhook Signature
    const isValidSignature = PaystackClient.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValidSignature) {
      AuditService.log({
        actorId: 'anonymous',
        actorRole: 'customer',
        action: 'PAYMENT_WEBHOOK_INVALID_SIGNATURE',
        resourceType: 'SECURITY',
        resourceId: 'webhook',
        details: { signatureProvided: signatureHeader ? 'PRESENT' : 'MISSING' },
      });
      return { success: false, statusCode: 401, message: 'Invalid webhook signature.' };
    }

    if (!eventPayload || !eventPayload.event) {
      return { success: false, statusCode: 400, message: 'Invalid webhook payload structure.' };
    }

    const eventName = eventPayload.event;
    const eventData = eventPayload.data || {};
    const reference = eventData.reference;

    if (!reference) {
      return { success: false, statusCode: 400, message: 'Missing transaction reference in webhook.' };
    }

    // 2. Webhook Idempotency: Check if this event was already processed
    const existingEvent = db.webhookEvents.find(
      (w) => w.providerReference === reference && w.event === eventName
    );

    if (existingEvent) {
      return {
        success: true,
        statusCode: 200,
        message: 'Webhook event already processed (Idempotent replay).',
        eventId: existingEvent.id,
      };
    }

    AuditService.log({
      actorId: 'paystack_webhook',
      actorRole: 'admin',
      action: 'PAYMENT_WEBHOOK_RECEIVED',
      resourceType: 'PAYMENT',
      resourceId: reference,
      details: { event: eventName },
    });

    // 3. Process supported events
    let processSuccess = false;
    if (eventName === 'charge.success') {
      const verifyRes = await this.verifyPayment({ reference });
      processSuccess = verifyRes.success;
    } else if (eventName === 'charge.failed') {
      const payment = db.payments.find(
        (p) => p.providerReference === reference || p.transactionRef === reference
      );
      if (payment) {
        payment.status = 'FAILED';
        payment.failedAt = new Date().toISOString();
        payment.failureReason = eventData.gateway_response || 'Charge failed at Paystack.';
        db.save();
      }
      processSuccess = true;
    } else if (eventName === 'refund.processed') {
      const payment = db.payments.find(
        (p) => p.providerReference === reference || p.transactionRef === reference
      );
      if (payment) {
        payment.status = 'REFUNDED';
        payment.refundedAt = new Date().toISOString();
        const earnings = db.technicianEarnings.find((e) => e.paymentId === payment.id);
        if (earnings) {
          earnings.status = 'REFUNDED';
          earnings.updatedAt = payment.refundedAt;
        }
        db.save();
      }
      processSuccess = true;
    } else {
      // Other unhandled events: record as IGNORED
      processSuccess = true;
    }

    // 4. Record Webhook Event for Audit & Idempotency
    const webhookRecord: WebhookEventRecord = {
      id: `whk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event: eventName,
      providerReference: reference,
      provider: 'PAYSTACK',
      payloadSummary: {
        amount: eventData.amount,
        currency: eventData.currency,
        status: eventData.status,
      },
      processedAt: new Date().toISOString(),
      status: processSuccess ? 'PROCESSED' : 'FAILED',
    };

    db.webhookEvents.push(webhookRecord);
    db.save();

    AuditService.log({
      actorId: 'paystack_webhook',
      actorRole: 'admin',
      action: 'PAYMENT_WEBHOOK_PROCESSED',
      resourceType: 'PAYMENT',
      resourceId: reference,
      details: { event: eventName, status: webhookRecord.status },
    });

    return {
      success: processSuccess,
      statusCode: 200,
      message: 'Webhook processed successfully.',
      eventId: webhookRecord.id,
    };
  }

  /**
   * Records a server-authorized refund for an existing payment.
   */
  public static recordRefund(params: {
    paymentId: string;
    amountNaira?: number;
    reason: string;
    actorId: string;
    actorRole: UserRole;
  }): { success: boolean; refund?: RefundRecord; error?: string } {
    const { paymentId, reason, actorId, actorRole } = params;

    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment) {
      return { success: false, error: 'Payment transaction record not found.' };
    }

    if (payment.status !== 'SUCCESS' && payment.status !== 'ESCROW_HELD') {
      return { success: false, error: 'Only successfully paid transactions can be refunded.' };
    }

    const refundAmount = params.amountNaira || payment.amountNaira;
    if (refundAmount <= 0 || refundAmount > payment.amountNaira) {
      return { success: false, error: 'Refund amount cannot exceed payment total.' };
    }

    const now = new Date().toISOString();
    const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const refund: RefundRecord = {
      id: refundId,
      paymentId: payment.id,
      repairId: payment.repairId,
      customerId: payment.customerId,
      amountNaira: refundAmount,
      reason,
      initiatedBy: actorId,
      actorRole,
      providerReference: payment.providerReference,
      status: 'COMPLETED',
      createdAt: now,
      processedAt: now,
    };

    db.refunds.push(refund);

    // Update payment record
    payment.status = refundAmount === payment.amountNaira ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    payment.refundedAt = now;
    payment.updatedAt = now;

    // Update job status if full refund
    if (refundAmount === payment.amountNaira) {
      const job = db.repairJobs.find((j) => j.id === payment.repairId);
      if (job) {
        job.status = 'REFUNDED';
        job.statusHistory.push({
          status: 'REFUNDED',
          timestamp: now,
          actorRole,
          note: `Refund of ₦${refundAmount.toLocaleString()} processed. Reason: ${reason}`,
        });
      }
    }

    // Update earnings record
    const earnings = db.technicianEarnings.find((e) => e.paymentId === payment.id);
    if (earnings) {
      earnings.status = 'REFUNDED';
      earnings.updatedAt = now;
    }

    AuditService.log({
      actorId,
      actorRole,
      action: 'PAYMENT_REFUNDED',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      details: { refundAmountNaira: refundAmount, reason },
    });

    NotificationService.send({
      userId: payment.customerId,
      title: 'Refund Processed',
      message: `A refund of ₦${refundAmount.toLocaleString()} has been processed for repair #${payment.repairId}.`,
      type: 'PAYMENT',
      repairId: payment.repairId,
    });

    db.save();
    return { success: true, refund };
  }

  /**
   * Payout Boundary: Initiates a payout request for a technician's eligible earnings.
   * Enforces strict check against eligible balance (HELD ≠ ELIGIBLE).
   */
  public static requestPayout(params: {
    technicianId: string;
    amountNaira: number;
    destinationAccount?: {
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    };
    actorId: string;
  }): { success: boolean; payout?: PayoutRecord; eligibleBalanceNaira?: number; error?: string } {
    const { technicianId, amountNaira, destinationAccount, actorId } = params;

    // 1. Authorization: Only technician can request their own payout
    if (actorId !== technicianId) {
      return { success: false, error: 'Unauthorized: You can only request payouts for your own earnings.' };
    }

    if (amountNaira <= 0) {
      return { success: false, error: 'Payout amount must be greater than zero.' };
    }

    // 2. Calculate technician's ELIGIBLE earnings
    // NOTE: Earnings with status 'HELD' are NOT yet eligible! They only become eligible when repair is completed.
    const eligibleEarnings = db.technicianEarnings.filter(
      (e) => e.technicianId === technicianId && e.status === 'ELIGIBLE_FOR_PAYOUT'
    );
    const totalEligibleNaira = eligibleEarnings.reduce((sum, e) => sum + e.netEarningsNaira, 0);

    // Subtract already initiated or pending payouts
    const existingPayouts = db.payouts.filter(
      (p) => p.technicianId === technicianId && (p.status === 'PENDING' || p.status === 'PROCESSING')
    );
    const lockedInPayoutNaira = existingPayouts.reduce((sum, p) => sum + p.amountNaira, 0);
    const availablePayoutNaira = Math.max(0, totalEligibleNaira - lockedInPayoutNaira);

    if (amountNaira > availablePayoutNaira) {
      return {
        success: false,
        eligibleBalanceNaira: availablePayoutNaira,
        error: `Insufficient eligible earnings. Available for payout: ₦${availablePayoutNaira.toLocaleString()} (Note: Active repair earnings are held until customer pickup).`,
      };
    }

    const now = new Date().toISOString();
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const payout: PayoutRecord = {
      id: payoutId,
      technicianId,
      amountNaira,
      currency: 'NGN',
      destinationAccount,
      provider: 'PAYSTACK_TRANSFERS',
      providerReference: `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      status: 'PROCESSING',
      createdAt: now,
      updatedAt: now,
    };

    db.payouts.push(payout);
    db.save();

    AuditService.log({
      actorId: technicianId,
      actorRole: 'technician',
      action: 'PAYOUT_INITIATED',
      resourceType: 'PAYOUT',
      resourceId: payoutId,
      details: { amountNaira, destinationAccount: destinationAccount?.accountNumber },
    });

    NotificationService.send({
      userId: technicianId,
      title: 'Payout Request Submitted',
      message: `Your payout request for ₦${amountNaira.toLocaleString()} is processing.`,
      type: 'PAYMENT',
    });

    return { success: true, payout, eligibleBalanceNaira: availablePayoutNaira - amountNaira };
  }

  /**
   * Backwards-compatible mock intent creation for Phase 3/4 test suite.
   */
  public static createPaymentIntent(params: {
    repairJobId: string;
    customerId: string;
    idempotencyKey: string;
    paymentMethod?: 'CARD' | 'BANK_TRANSFER' | 'USSD';
  }): { payment: PaymentTransaction; isExisting: boolean } | { error: string } {
    const job = db.repairJobs.find((j) => j.id === params.repairJobId);
    if (!job) {
      return { error: 'Repair job not found.' };
    }
    if (job.customerId !== params.customerId) {
      return { error: 'Unauthorized: You cannot pay for another customer’s repair.' };
    }

    const existing = db.payments.find(
      (p) =>
        p.idempotencyKey === params.idempotencyKey ||
        (p.repairId === params.repairJobId && (p.status === 'ESCROW_HELD' || p.status === 'SUCCESS'))
    );
    if (existing) {
      return { payment: existing, isExisting: true };
    }

    const totalAmount = job.finalAmount || job.originalQuoteAmount;
    const platformFee = Math.round(totalAmount * this.COMMISSION_RATE);
    const technicianPayout = totalAmount - platformFee;

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txRef = `FIX-PAY-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment: PaymentTransaction = {
      id: paymentId,
      repairId: params.repairJobId,
      customerId: params.customerId,
      technicianId: job.technicianId,
      quoteId: job.quoteId,
      amountNaira: totalAmount,
      platformFeeNaira: platformFee,
      technicianPayoutNaira: technicianPayout,
      currency: 'NGN',
      provider: 'PAYSTACK_SANDBOX',
      status: 'INITIATED',
      transactionRef: txRef,
      providerReference: txRef,
      idempotencyKey: params.idempotencyKey,
      paymentMethod: params.paymentMethod || 'CARD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.payments.push(payment);
    db.save();

    AuditService.log({
      actorId: params.customerId,
      actorRole: 'customer',
      action: 'PAYMENT_INTENT_CREATED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      details: { amountNaira: totalAmount, repairJobId: params.repairJobId, txRef },
    });

    return { payment, isExisting: false };
  }

  /**
   * Backwards-compatible verify mock / escrow holding for Phase 3/4 test suite.
   */
  public static verifyAndHoldInEscrow(params: {
    paymentId: string;
    transactionRef: string;
    actorId: string;
    actorRole: UserRole;
  }): { success: boolean; payment?: PaymentTransaction; error?: string } {
    const payment = db.payments.find(
      (p) => p.id === params.paymentId || p.transactionRef === params.transactionRef
    );
    if (!payment) {
      return { success: false, error: 'Payment record not found.' };
    }

    if (params.actorRole === 'customer' && payment.customerId !== params.actorId) {
      return { success: false, error: 'Unauthorized: Payment does not belong to you.' };
    }

    const job = db.repairJobs.find((j) => j.id === payment.repairId);
    if (!job) {
      return { success: false, error: 'Associated repair job not found.' };
    }

    if (params.actorRole === 'customer' && job.customerId !== params.actorId) {
      return { success: false, error: 'Unauthorized: Repair job does not belong to you.' };
    }

    if (payment.status === 'ESCROW_HELD' || payment.status === 'SUCCESS') {
      return { success: true, payment };
    }

    payment.status = 'ESCROW_HELD';
    payment.paidAt = new Date().toISOString();

    job.status = 'BOOKED';
    job.bookedAt = payment.paidAt;
    job.statusHistory.push({
      status: 'PAYMENT_CONFIRMED',
      timestamp: payment.paidAt,
      actorRole: 'customer',
      note: `₦${payment.amountNaira.toLocaleString()} confirmed (Ref: ${payment.transactionRef})`,
    });
    job.statusHistory.push({
      status: 'BOOKED',
      timestamp: payment.paidAt,
      actorRole: 'customer',
      note: 'Repair job booked. Awaiting physical device check-in at shop.',
    });

    const request = db.repairRequests.find((r) => r.id === job.requestId);
    if (request) {
      request.status = 'BOOKED';
      request.updatedAt = payment.paidAt;
    }

    // Record technician earnings
    let earnings = db.technicianEarnings.find((e) => e.paymentId === payment.id);
    if (!earnings) {
      earnings = {
        id: `earn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        technicianId: job.technicianId,
        repairId: job.id,
        paymentId: payment.id,
        grossAmountNaira: payment.amountNaira,
        platformFeeNaira: payment.platformFeeNaira,
        netEarningsNaira: payment.technicianPayoutNaira,
        commissionPercent: Math.round(this.COMMISSION_RATE * 1000) / 10,
        status: 'HELD',
        createdAt: payment.paidAt,
        updatedAt: payment.paidAt,
      };
      db.technicianEarnings.push(earnings);
    }

    NotificationService.send({
      userId: job.technicianId,
      title: 'Payment Confirmed',
      message: `Payment of ₦${payment.amountNaira.toLocaleString()} for ${job.deviceBrand} ${job.deviceModel} is confirmed. Estimated earnings: ₦${payment.technicianPayoutNaira.toLocaleString()} (Held).`,
      type: 'PAYMENT',
      repairId: job.id,
    });

    NotificationService.send({
      userId: job.customerId,
      title: 'Payment Confirmed',
      message: `Your payment of ₦${payment.amountNaira.toLocaleString()} is confirmed. Take your phone to the technician to begin repair.`,
      type: 'PAYMENT',
      repairId: job.id,
    });

    AuditService.log({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: 'PAYMENT_ESCROW_CONFIRMED',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      details: { amountNaira: payment.amountNaira, status: 'ESCROW_HELD' },
    });

    db.save();
    return { success: true, payment };
  }

  /**
   * Releases held earnings to ELIGIBLE_FOR_PAYOUT upon completion of repair.
   */
  public static releaseTechnicianFunds(
    paramOrId: { repairJobId: string; actorId?: string; actorRole?: UserRole } | string,
    actorId?: string,
    actorRole?: UserRole
  ): { success: boolean; error?: string } {
    const repairJobId = typeof paramOrId === 'string' ? paramOrId : paramOrId.repairJobId;
    const resolvedActorId = typeof paramOrId === 'string' ? actorId || 'system' : paramOrId.actorId || 'system';
    const resolvedActorRole = typeof paramOrId === 'string' ? actorRole || 'admin' : paramOrId.actorRole || 'admin';

    const payment = db.payments.find(
      (p) =>
        p.repairId === repairJobId &&
        (p.status === 'ESCROW_HELD' || p.status === 'SUCCESS')
    );
    if (!payment) {
      return { success: false, error: 'No confirmed payment eligible for release.' };
    }

    payment.status = 'RELEASED_TO_TECHNICIAN';
    payment.releasedAt = new Date().toISOString();

    const earnings = db.technicianEarnings.find(
      (e) => e.paymentId === payment.id || e.repairId === repairJobId
    );
    if (earnings) {
      earnings.status = 'ELIGIBLE_FOR_PAYOUT';
      earnings.releasedAt = payment.releasedAt;
      earnings.updatedAt = payment.releasedAt;
    }

    NotificationService.send({
      userId: payment.technicianId,
      title: 'Earnings Eligible for Payout',
      message: `₦${payment.technicianPayoutNaira.toLocaleString()} is now eligible for payout for repair #${payment.repairId}.`,
      type: 'PAYMENT',
      repairId: payment.repairId,
    });

    AuditService.log({
      actorId: resolvedActorId,
      actorRole: resolvedActorRole,
      action: 'EARNINGS_MADE_ELIGIBLE_FOR_PAYOUT',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      details: {
        totalAmountNaira: payment.amountNaira,
        platformFeeNaira: payment.platformFeeNaira,
        payoutAmountNaira: payment.technicianPayoutNaira,
      },
    });

    db.save();
    return { success: true };
  }
}

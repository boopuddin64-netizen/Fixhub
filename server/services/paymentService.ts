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
    } else if (eventName === 'transfer.success') {
      // Handle successful Paystack technician transfer
      const payout = db.payouts.find(
        (p) => p.providerReference === reference || (eventData.transfer_code && p.providerReference === eventData.transfer_code)
      );
      if (payout) {
        payout.status = 'COMPLETED';
        payout.processedAt = new Date().toISOString();
        payout.updatedAt = payout.processedAt;

        // Mark associated technician earnings as PAID_OUT
        const eligibleEarnings = db.technicianEarnings.filter(
          (e) => e.technicianId === payout.technicianId && (e.status === 'ELIGIBLE_FOR_PAYOUT' || e.status === 'PAYOUT_INITIATED')
        );
        let remainingToMark = payout.amountNaira;
        for (const earn of eligibleEarnings) {
          if (remainingToMark <= 0) break;
          earn.status = 'PAID_OUT';
          earn.paidOutAt = payout.processedAt;
          earn.updatedAt = payout.processedAt;
          remainingToMark -= earn.netEarningsNaira;
        }

        NotificationService.send({
          userId: payout.technicianId,
          title: 'Payout Delivered',
          message: `Your transfer of ₦${payout.amountNaira.toLocaleString()} has been confirmed by your bank via Paystack.`,
          type: 'PAYMENT',
        });

        AuditService.log({
          actorId: 'paystack_webhook',
          actorRole: 'admin',
          action: 'PAYOUT_COMPLETED',
          resourceType: 'PAYOUT',
          resourceId: payout.id,
          details: { amountNaira: payout.amountNaira, reference },
        });

        db.save();
      }
      processSuccess = true;
    } else if (eventName === 'transfer.failed' || eventName === 'transfer.reversed') {
      // Handle failed or reversed Paystack technician transfer
      const payout = db.payouts.find(
        (p) => p.providerReference === reference || (eventData.transfer_code && p.providerReference === eventData.transfer_code)
      );
      if (payout) {
        payout.status = 'FAILED';
        payout.failureReason = eventData.gateway_response || eventData.reason || 'Transfer failed or reversed by bank.';
        payout.updatedAt = new Date().toISOString();

        NotificationService.send({
          userId: payout.technicianId,
          title: 'Payout Failed',
          message: `Your transfer of ₦${payout.amountNaira.toLocaleString()} failed: ${payout.failureReason}. Your earnings remain eligible.`,
          type: 'PAYMENT',
        });

        AuditService.log({
          actorId: 'paystack_webhook',
          actorRole: 'admin',
          action: 'PAYOUT_FAILED',
          resourceType: 'PAYOUT',
          resourceId: payout.id,
          details: { amountNaira: payout.amountNaira, reference, reason: payout.failureReason },
        });

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

        const refund = db.refunds.find((r) => r.paymentId === payment.id);
        if (refund) {
          refund.status = 'COMPLETED';
          refund.processedAt = payment.refundedAt;
        }

        db.save();
      }
      processSuccess = true;
    } else if (eventName === 'refund.failed') {
      const refund = db.refunds.find((r) => r.providerReference === reference);
      if (refund) {
        refund.status = 'FAILED';
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
   * Records a server-authorized refund for an existing payment via Paystack Refund API.
   * Enforces object ownership, remaining refundable balance, and provider call.
   */
  public static async recordRefund(params: {
    paymentId: string;
    amountNaira?: number;
    reason: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; refund?: RefundRecord; error?: string }> {
    const { paymentId, reason, actorId, actorRole } = params;

    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment) {
      return { success: false, error: 'Payment transaction record not found.' };
    }

    // 1. Authorization: Only the paying customer or admin can refund
    if (actorRole !== 'admin' && payment.customerId !== actorId) {
      return { success: false, error: 'Unauthorized: You can only refund your own payment.' };
    }

    // 2. Status check
    if (payment.status !== 'SUCCESS' && payment.status !== 'ESCROW_HELD') {
      return { success: false, error: 'Only successfully confirmed payments can be refunded.' };
    }

    // 3. Amount integrity check
    const alreadyRefunded = payment.refundedAmountNaira || 0;
    const remainingRefundable = payment.amountNaira - alreadyRefunded;
    if (remainingRefundable <= 0) {
      return { success: false, error: 'Payment has already been fully refunded.' };
    }

    const refundAmount = params.amountNaira ? Number(params.amountNaira) : remainingRefundable;
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return { success: false, error: 'Refund amount must be a positive number.' };
    }

    if (refundAmount > remainingRefundable) {
      return {
        success: false,
        error: `Refund amount exceeds remaining refundable balance of ₦${remainingRefundable.toLocaleString()}.`,
      };
    }

    // 4. Call Paystack Refund API
    const paystackRefundRes = await PaystackClient.createRefund({
      transactionRefOrId: payment.providerReference || payment.transactionRef,
      amountKobo: refundAmount * 100,
      merchantNote: reason,
    });

    if (!paystackRefundRes.success) {
      return { success: false, error: paystackRefundRes.message || 'Failed to process refund at Paystack.' };
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
      providerReference: paystackRefundRes.transactionReference || payment.providerReference,
      status: paystackRefundRes.status === 'processed' ? 'COMPLETED' : 'PENDING',
      createdAt: now,
      processedAt: now,
    };

    db.refunds.push(refund);

    // Update payment record
    payment.refundedAmountNaira = alreadyRefunded + refundAmount;
    payment.status = payment.refundedAmountNaira >= payment.amountNaira ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    payment.refundedAt = now;
    payment.updatedAt = now;

    // Update job status if full refund
    if (payment.refundedAmountNaira >= payment.amountNaira) {
      const job = db.repairJobs.find((j) => j.id === payment.repairId);
      if (job) {
        job.status = 'REFUNDED';
        job.statusHistory.push({
          status: 'REFUNDED',
          timestamp: now,
          actorRole,
          note: `Refund of ₦${refundAmount.toLocaleString()} processed via Paystack. Reason: ${reason}`,
        });
      }

      // Update earnings record
      const earnings = db.technicianEarnings.find((e) => e.paymentId === payment.id);
      if (earnings) {
        earnings.status = 'REFUNDED';
        earnings.updatedAt = now;
      }
    }

    AuditService.log({
      actorId,
      actorRole,
      action: 'PAYMENT_REFUNDED',
      resourceType: 'PAYMENT',
      resourceId: payment.id,
      details: {
        refundAmountNaira: refundAmount,
        totalRefundedNaira: payment.refundedAmountNaira,
        status: payment.status,
        reason,
      },
    });

    NotificationService.send({
      userId: payment.customerId,
      title: 'Refund Processed',
      message: `A refund of ₦${refundAmount.toLocaleString()} has been processed via Paystack for repair #${payment.repairId}.`,
      type: 'PAYMENT',
      repairId: payment.repairId,
    });

    db.save();
    return { success: true, refund };
  }

  /**
   * Payout Boundary: Initiates a real payout request for a technician's eligible earnings via Paystack Transfers.
   * Enforces strict check against eligible balance (HELD ≠ ELIGIBLE).
   */
  public static async requestPayout(params: {
    technicianId: string;
    amountNaira: number;
    destinationAccount?: {
      bankCode: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
    };
    actorId: string;
  }): Promise<{ success: boolean; payout?: PayoutRecord; eligibleBalanceNaira?: number; error?: string }> {
    const { technicianId, amountNaira, actorId } = params;

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

    // 3. Resolve Destination Bank Account
    let destinationAccount = params.destinationAccount;
    if (!destinationAccount || !destinationAccount.accountNumber || !destinationAccount.bankCode) {
      const profile = db.technicianProfiles.find((t) => t.userId === technicianId);
      if (profile?.bankDetails?.accountNumber && profile?.bankDetails?.bankCode) {
        destinationAccount = {
          bankCode: profile.bankDetails.bankCode,
          bankName: profile.bankDetails.bankName || 'Verified Bank',
          accountNumber: profile.bankDetails.accountNumber,
          accountName: profile.bankDetails.accountName || profile.businessName || 'Technician',
        };
      } else {
        return {
          success: false,
          eligibleBalanceNaira: availablePayoutNaira,
          error: 'Technician payout bank details are missing or unverified. Please configure your registered Nigerian bank account in your profile before requesting a payout.',
        };
      }
    } else {
      const cleanAccount = String(destinationAccount.accountNumber).trim();
      const cleanBankCode = String(destinationAccount.bankCode).trim();
      if (!/^\d{10}$/.test(cleanAccount) || !/^\d{3,6}$/.test(cleanBankCode)) {
        return {
          success: false,
          eligibleBalanceNaira: availablePayoutNaira,
          error: 'Invalid bank account details. A valid 10-digit NUBAN account number and Nigerian bank code are required.',
        };
      }
    }

    // 4. Create Paystack Transfer Recipient
    const recipientRes = await PaystackClient.createTransferRecipient({
      name: destinationAccount.accountName,
      accountNumber: destinationAccount.accountNumber,
      bankCode: destinationAccount.bankCode,
    });

    if (!recipientRes.success || !recipientRes.recipientCode) {
      return {
        success: false,
        eligibleBalanceNaira: availablePayoutNaira,
        error: recipientRes.message || 'Failed to register transfer recipient at Paystack.',
      };
    }

    // 5. Initiate Paystack Transfer
    const transferRef = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const transferRes = await PaystackClient.initiateTransfer({
      amountKobo: amountNaira * 100,
      recipientCode: recipientRes.recipientCode,
      reference: transferRef,
      reason: `Fix Hub Technician Repair Earnings Payout`,
    });

    if (!transferRes.success) {
      return {
        success: false,
        eligibleBalanceNaira: availablePayoutNaira,
        error: transferRes.message || 'Failed to initiate transfer via Paystack.',
      };
    }

    const now = new Date().toISOString();
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isCompleted = transferRes.status === 'success';

    const payout: PayoutRecord = {
      id: payoutId,
      technicianId,
      amountNaira,
      currency: 'NGN',
      destinationAccount,
      provider: 'PAYSTACK_TRANSFERS',
      providerReference: transferRes.transferCode || transferRef,
      status: isCompleted ? 'COMPLETED' : 'PROCESSING',
      createdAt: now,
      updatedAt: now,
      processedAt: isCompleted ? now : undefined,
    };

    db.payouts.push(payout);

    // If completed immediately (e.g. sandbox or instant transfer), mark earnings
    if (isCompleted) {
      let remainingToMark = amountNaira;
      for (const earn of eligibleEarnings) {
        if (remainingToMark <= 0) break;
        earn.status = 'PAID_OUT';
        earn.paidOutAt = now;
        earn.updatedAt = now;
        remainingToMark -= earn.netEarningsNaira;
      }
    }

    db.save();

    AuditService.log({
      actorId: technicianId,
      actorRole: 'technician',
      action: 'PAYOUT_INITIATED',
      resourceType: 'PAYOUT',
      resourceId: payoutId,
      details: {
        amountNaira,
        destinationAccount: destinationAccount.accountNumber,
        transferRef,
        status: payout.status,
      },
    });

    NotificationService.send({
      userId: technicianId,
      title: 'Payout Request Submitted',
      message: `Your payout request for ₦${amountNaira.toLocaleString()} is processing via Paystack Transfers.`,
      type: 'PAYMENT',
    });

    return { success: true, payout, eligibleBalanceNaira: availablePayoutNaira - amountNaira };
  }

  /**
   * Releases held earnings to ELIGIBLE_FOR_PAYOUT upon completion of repair.
   */
  public static releaseFundsOnCompletion(
    paramOrId: { repairJobId: string; actorId?: string; actorRole?: UserRole } | string,
    actorId?: string,
    actorRole?: UserRole
  ): { success: boolean; error?: string } {
    return this.releaseTechnicianFunds(paramOrId, actorId, actorRole);
  }

  /**
   * Releases held earnings to ELIGIBLE_FOR_PAYOUT upon completion of repair (backward compatible alias).
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

  /**
   * Reconciles unconfirmed / pending payments by querying Paystack for transaction status.
   * Useful for handling missed webhooks or dropped network sessions.
   */
  public static async reconcilePendingPayments(options?: { maxAgeHours?: number }): Promise<{
    checkedCount: number;
    reconciledCount: number;
    failedCount: number;
    results: Array<{ paymentId: string; reference: string; status: string; outcome: string }>;
  }> {
    const maxAgeMs = (options?.maxAgeHours || 48) * 60 * 60 * 1000;
    const now = Date.now();

    // Find payments stuck in INITIATED state within the reconciliation window
    const pendingPayments = db.payments.filter((p) => {
      if (p.status !== 'INITIATED') return false;
      const createdTime = new Date(p.createdAt || 0).getTime();
      return now - createdTime <= maxAgeMs;
    });

    let reconciledCount = 0;
    let failedCount = 0;
    const results: Array<{ paymentId: string; reference: string; status: string; outcome: string }> = [];

    for (const payment of pendingPayments) {
      const ref = payment.providerReference || payment.transactionRef;
      if (!ref) continue;

      try {
        const verifyRes = await this.verifyPayment({
          reference: ref,
          actorId: 'system_reconciliation',
          actorRole: 'admin',
        });

        if (verifyRes.success) {
          reconciledCount++;
          results.push({
            paymentId: payment.id,
            reference: ref,
            status: payment.status,
            outcome: verifyRes.alreadyVerified ? 'ALREADY_VERIFIED' : 'RECONCILED_SUCCESS',
          });
        } else {
          // If transaction is older than 24 hours and still unresolved, mark as expired
          const ageHours = (now - new Date(payment.createdAt || 0).getTime()) / (1000 * 60 * 60);
          if (ageHours > 24) {
            payment.status = 'FAILED';
            payment.failureReason = 'Payment session expired without completion.';
            payment.failedAt = new Date().toISOString();
            db.save();
          }
          failedCount++;
          results.push({
            paymentId: payment.id,
            reference: ref,
            status: payment.status,
            outcome: verifyRes.error || 'UNRESOLVED',
          });
        }
      } catch (err: any) {
        results.push({
          paymentId: payment.id,
          reference: ref,
          status: payment.status,
          outcome: `ERROR: ${err?.message || 'Unknown error'}`,
        });
      }
    }

    return {
      checkedCount: pendingPayments.length,
      reconciledCount,
      failedCount,
      results,
    };
  }
}


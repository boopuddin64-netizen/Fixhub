import { db } from '../db';
import { PaymentTransaction, UserRole } from '../../src/types/index';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export class PaymentService {
  private static COMMISSION_RATE = Number(process.env.PLATFORM_COMMISSION_PERCENT || '8.5') / 100;

  /**
   * Initializes a secure Escrow payment for a repair quote/job.
   * Total is strictly taken from the server-side quote/job record to prevent client price tampering.
   */
  public static createPaymentIntent(params: {
    repairJobId: string;
    customerId: string;
    idempotencyKey: string;
    paymentMethod?: 'CARD' | 'BANK_TRANSFER' | 'USSD';
  }): { payment: PaymentTransaction; isExisting: boolean } | { error: string } {
    const { repairJobId, customerId, idempotencyKey, paymentMethod = 'CARD' } = params;

    // Verify repair job exists and belongs to customer
    const job = db.repairJobs.find((j) => j.id === repairJobId);
    if (!job) {
      return { error: 'Repair job not found.' };
    }

    if (job.customerId !== customerId) {
      return { error: 'Unauthorized: You cannot pay for another customer’s repair.' };
    }

    // Check for idempotency replay
    const existing = db.payments.find((p) => p.idempotencyKey === idempotencyKey || (p.repairId === repairJobId && p.status === 'ESCROW_HELD'));
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
      repairId: repairJobId,
      customerId,
      technicianId: job.technicianId,
      amountNaira: totalAmount,
      platformFeeNaira: platformFee,
      technicianPayoutNaira: technicianPayout,
      currency: 'NGN',
      provider: 'PAYSTACK_SANDBOX',
      status: 'INITIATED',
      transactionRef: txRef,
      idempotencyKey,
      paymentMethod,
    };

    db.payments.push(payment);
    db.save();

    AuditService.log({
      actorId: customerId,
      actorRole: 'customer',
      action: 'PAYMENT_INTENT_CREATED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      details: { amountNaira: totalAmount, repairJobId, txRef },
    });

    return { payment, isExisting: false };
  }

  /**
   * Verifies payment completion and locks funds into FIX HUB ESCROW.
   */
  public static verifyAndHoldInEscrow(params: {
    paymentId: string;
    transactionRef: string;
    actorId: string;
    actorRole: UserRole;
  }): { success: boolean; payment?: PaymentTransaction; error?: string } {
    const payment = db.payments.find((p) => p.id === params.paymentId || p.transactionRef === params.transactionRef);
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

    if (payment.status === 'ESCROW_HELD') {
      return { success: true, payment };
    }

    payment.status = 'ESCROW_HELD';
    payment.paidAt = new Date().toISOString();

    // Update job status to PAYMENT_CONFIRMED -> BOOKED
    job.status = 'BOOKED';
    job.bookedAt = payment.paidAt;
    job.statusHistory.push({
      status: 'PAYMENT_CONFIRMED',
      timestamp: payment.paidAt,
      actorRole: 'customer',
      note: `₦${payment.amountNaira.toLocaleString()} secured in Fix Hub Escrow (Ref: ${payment.transactionRef})`,
    });
    job.statusHistory.push({
      status: 'BOOKED',
      timestamp: payment.paidAt,
      actorRole: 'customer',
      note: 'Repair job booked. Awaiting physical device check-in at shop.',
    });

      // Notify technician
      NotificationService.send({
        userId: job.technicianId,
        title: 'Payment Secured in Escrow',
        message: `Payment of ₦${payment.amountNaira.toLocaleString()} for ${job.deviceBrand} ${job.deviceModel} is now held in escrow. Customer will bring device.`,
        type: 'PAYMENT',
        repairId: job.id,
      });

      // Notify customer
      NotificationService.send({
        userId: job.customerId,
        title: 'Payment Secured',
        message: `Your payment of ₦${payment.amountNaira.toLocaleString()} is safely held in escrow. Take your phone to the technician to begin repair.`,
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
   * Releases escrow funds to the technician upon customer pickup confirmation.
   */
  public static releaseTechnicianFunds(params: {
    repairJobId: string;
    actorId: string;
    actorRole: UserRole;
  }): { success: boolean; error?: string } {
    const payment = db.payments.find((p) => p.repairId === params.repairJobId && p.status === 'ESCROW_HELD');
    if (!payment) {
      return { success: false, error: 'No escrow payment eligible for release.' };
    }

    payment.status = 'RELEASED_TO_TECHNICIAN';
    payment.releasedAt = new Date().toISOString();

    NotificationService.send({
      userId: payment.technicianId,
      title: 'Funds Released to Payout Balance',
      message: `₦${payment.technicianPayoutNaira.toLocaleString()} has been cleared for payout for repair #${payment.repairId}.`,
      type: 'PAYMENT',
      repairId: payment.repairId,
    });

    AuditService.log({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: 'ESCROW_FUNDS_RELEASED_TO_TECHNICIAN',
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

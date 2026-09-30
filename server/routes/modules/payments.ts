import { Request, Response } from 'express';
import { PaymentService } from '../../services/paymentService';
import { AuditService } from '../../services/auditService';
import { AdminAuthService, adminReauthRequired } from '../../services/adminAuthService';
import { paymentRateLimiter, webhookRateLimiter } from '../../middleware/rateLimiters';
import { isNonEmptyString, sanitizeString } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole } from './shared';

/* -------------------------------------------------------------
 * 6. PAYMENTS & ESCROW (Server-Authoritative Amounts & Ownership)
 * ----------------------------------------------------------- */
apiRouter.post('/payments/initialize', paymentRateLimiter, requireAuth, requireRole(['customer']), async (req: AuthenticatedRequest, res: Response) => {
  const { repairJobId, idempotencyKey, paymentMethod } = req.body;
  if (!isNonEmptyString(repairJobId) || !isNonEmptyString(idempotencyKey)) {
    return res.status(400).json({ error: 'Repair Job ID and Idempotency Key are required.' });
  }

  const allowedMethods = ['CARD', 'BANK_TRANSFER', 'USSD'] as const;
  const resolvedMethod = allowedMethods.includes(paymentMethod) ? paymentMethod : 'CARD';

  const result = await PaymentService.initializePayment({
    repairJobId,
    customerId: req.user!.id,
    idempotencyKey: sanitizeString(idempotencyKey, 100),
    paymentMethod: resolvedMethod,
    customerEmail: req.user!.email,
  });

  if (!result.success) {
    return res.status(400).json({ error: 'error' in result ? result.error : 'Payment initialization failed.' });
  }

  return res.json(result);
});

apiRouter.post('/payments/verify', paymentRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { reference, paymentId } = req.body;
  if (!reference && !paymentId) {
    return res.status(400).json({ error: 'Transaction Reference or Payment ID is required.' });
  }

  const result = await PaymentService.verifyPayment({
    reference: reference ? String(reference) : '',
    paymentId: paymentId ? String(paymentId) : '',
    actorId: req.user!.id,
    actorRole: req.user!.role,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/payments/webhook', webhookRateLimiter, async (req: Request, res: Response) => {
  const signatureHeader = req.headers['x-paystack-signature'] as string | undefined;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  const result = await PaymentService.processWebhook({
    rawBody,
    signatureHeader,
    eventPayload: req.body,
  });

  return res.status(result.statusCode).json(result);
});

apiRouter.post('/payments/reconcile', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { maxAgeHours } = req.body;
  const result = await PaymentService.reconcilePendingPayments({
    maxAgeHours: typeof maxAgeHours === 'number' && maxAgeHours > 0 ? maxAgeHours : 48,
  });
  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'admin',
    action: 'ADMIN_PAYMENTS_RECONCILED',
    resourceType: 'PAYMENT',
    resourceId: 'batch',
    details: { checked: result.checkedCount, reconciled: result.reconciledCount, failed: result.failedCount, via: 'legacy-endpoint' },
    ipAddress: req.ip,
  });
  return res.json(result);
});

apiRouter.post('/payments/refund', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { paymentId, amountNaira, reason } = req.body;
  if (!paymentId || !reason) {
    return res.status(400).json({ error: 'Payment ID and Refund Reason are required.' });
  }
  if (adminReauthRequired()) {
    const check = AdminAuthService.confirmPassword(req.user!.id, req.body?.adminPassword);
    if (!check.ok) {
      return res.status(check.reason === 'LOCKED' ? 423 : 403).json({ error: 'Admin password confirmation failed.', code: 'ADMIN_REAUTH_FAILED' });
    }
  }

  const result = await PaymentService.recordRefund({
    paymentId: String(paymentId),
    amountNaira: amountNaira ? Number(amountNaira) : undefined,
    reason: sanitizeString(reason, 300),
    actorId: req.user!.id,
    actorRole: req.user!.role,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/technicians/payouts/request', requireAuth, requireRole(['technician']), async (req: AuthenticatedRequest, res: Response) => {
  const { amountNaira, destinationAccount } = req.body;
  if (!amountNaira || Number(amountNaira) <= 0) {
    return res.status(400).json({ error: 'Valid payout amount in Naira is required.' });
  }

  const result = await PaymentService.requestPayout({
    technicianId: req.user!.id,
    amountNaira: Math.round(Number(amountNaira)),
    destinationAccount,
    actorId: req.user!.id,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error, eligibleBalanceNaira: result.eligibleBalanceNaira });
  }

  return res.json(result);
});

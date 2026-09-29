import { Request, Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { TechnicianMatchingService } from '../../services/technicianMatchingService';
import { RepairWorkflowService } from '../../services/repairWorkflowService';
import { AuditService } from '../../services/auditService';
import { NotificationService } from '../../services/notificationService';
import { InventoryService } from '../../services/inventoryService';
import { calculateDistanceKm } from '../../services/technicianMatchingService';
import { paginate } from '../../utils/pagination';
import { PartsQuality } from '../../../src/types/index';
import { isNonEmptyString, sanitizeString, validateNumber, sanitizeRepairRequestForTechnician } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole, sanitizeQuoteForCustomer } from './shared';

/* -------------------------------------------------------------
 * 5. TECHNICIAN QUOTES (Strict Validation & Inventory-Backed Pricing)
 * ----------------------------------------------------------- */
apiRouter.post('/quotes/submit', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const {
    requestId,
    items,
    parts,
    partsCost,
    laborCost,
    diagnosticCost,
    otherCost,
    estimatedTimeHours,
    warrantyDays,
    partsQuality,
    notes,
    limitationsOrConditions,
    validityDays,
    quoteId: targetQuoteId,
  } = req.body;

  if (!isNonEmptyString(requestId)) {
    return res.status(400).json({ error: 'Request ID is required.' });
  }

  let user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    user = {
      id: req.user!.id,
      email: req.user!.email || `tech_${req.user!.id}@fixhub.local`,
      name: req.user!.email ? req.user!.email.split('@')[0] : 'Technician',
      phone: '',
      role: 'technician',
      createdAt: new Date().toISOString(),
      emailVerified: true,
      phoneVerified: false,
    } as any;
    db.users.push(user);
  }
  const tech = AuthService.ensureTechnicianProfile(user);
  const request = db.repairRequests.find((r) => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }

  // 1. Verify request is open for quotes
  if (
    request.status !== 'REQUESTED' &&
    request.status !== 'QUOTING' &&
    request.status !== 'SUBMITTED' &&
    request.status !== 'MATCHING'
  ) {
    return res.status(400).json({
      error: `Cannot submit quote: Repair request is not open for quoting (current status: ${request.status}).`,
    });
  }

  // 2. Verify technician eligibility
  const eligibility = TechnicianMatchingService.isTechnicianEligible(tech, request);
  if (!eligibility.eligible) {
    return res.status(403).json({
      error: `Ineligible to quote: ${eligibility.reason}`,
    });
  }

  // 3. Authoritative Inventory Line Items Processing
  const rawItems = Array.isArray(items) ? items : (Array.isArray(parts) ? parts : undefined);
  let resolvedLineItems: any[] = [];
  let serverCalculatedPartsCost = 0;
  let serverPredominantQuality: PartsQuality = 'PREMIUM_AFTERMARKET';
  let serverMaxWarrantyDays = 30;
  let priceAuditMetadata: any = undefined;

  if (rawItems && rawItems.length > 0) {
    const validatedInventory = InventoryService.validateAndBuildQuoteLineItems(
      req.user!.id,
      rawItems,
      request
    );

    if (validatedInventory.valid === false) {
      return res.status(400).json({ error: validatedInventory.error });
    }

    resolvedLineItems = validatedInventory.items;
    serverCalculatedPartsCost = validatedInventory.totalPartsCost;
    serverPredominantQuality = validatedInventory.predominantQuality;
    serverMaxWarrantyDays = validatedInventory.maxWarrantyDays;
    priceAuditMetadata = validatedInventory.priceAuditMetadata;
  } else if (partsCost !== undefined && partsCost !== null && Number(partsCost) > 0) {
    return res.status(400).json({
      error: 'Direct partsCost submission is deprecated and rejected. All repair parts must be itemized from your inventory using the items array.',
    });
  } else {
    // Labor-only repair with 0 parts cost
    serverCalculatedPartsCost = 0;
    resolvedLineItems = [];
    serverPredominantQuality = partsQuality || 'PREMIUM_AFTERMARKET';
    serverMaxWarrantyDays = warrantyDays ? Number(warrantyDays) : 30;
  }

  // 4. Numerical Cost Validation
  const laborVal = validateNumber(laborCost, 'Labor cost', { min: 0, max: 10_000_000 });
  if (laborVal.valid === false) return res.status(400).json({ error: laborVal.error });

  const diagnosticVal =
    diagnosticCost !== undefined && diagnosticCost !== null && diagnosticCost !== ''
      ? validateNumber(diagnosticCost, 'Diagnostic fee', { min: 0, max: 10_000_000 })
      : { valid: true as const, value: 0 };
  if (diagnosticVal.valid === false) return res.status(400).json({ error: diagnosticVal.error });

  const otherVal =
    otherCost !== undefined && otherCost !== null && otherCost !== ''
      ? validateNumber(otherCost, 'Other cost', { min: 0, max: 10_000_000 })
      : { valid: true as const, value: 0 };
  if (otherVal.valid === false) return res.status(400).json({ error: otherVal.error });

  const hoursVal = validateNumber(estimatedTimeHours || 2, 'Estimated time', { min: 1, max: 720, integerOnly: true });
  if (hoursVal.valid === false) return res.status(400).json({ error: hoursVal.error });

  const minWarranty = Math.max(14, serverMaxWarrantyDays);
  const warrantyVal = validateNumber(warrantyDays || minWarranty, 'Warranty days', { min: 14, max: 365, integerOnly: true });
  if (warrantyVal.valid === false) return res.status(400).json({ error: warrantyVal.error });

  // Server-Authoritative Total Calculation (never trust client total)
  const totalAmount = serverCalculatedPartsCost + laborVal.value + diagnosticVal.value + otherVal.value;
  if (totalAmount <= 0) {
    return res.status(400).json({ error: 'Total quote amount must be greater than zero.' });
  }

  const allowedQualities: PartsQuality[] = [
    'ORIGINAL_MANUFACTURER',
    'ORIGINAL_OEM',
    'OEM',
    'PREMIUM_AFTERMARKET',
    'STANDARD_AFTERMARKET',
    'USED_REFURBISHED',
    'REFURBISHED',
    'UNKNOWN',
  ];

  const resolvedQuality: PartsQuality =
    partsQuality && allowedQualities.includes(partsQuality)
      ? partsQuality
      : serverPredominantQuality;

  const distanceKm =
    eligibility.distanceKm ??
    (request.customerLocation &&
    typeof request.customerLocation.lat === 'number' &&
    typeof request.customerLocation.lng === 'number' &&
    tech.shopLocation &&
    typeof tech.shopLocation.lat === 'number' &&
    typeof tech.shopLocation.lng === 'number'
      ? calculateDistanceKm(
          request.customerLocation.lat,
          request.customerLocation.lng,
          tech.shopLocation.lat,
          tech.shopLocation.lng
        )
      : undefined);

  // Check if modifying a specific quote by ID
  if (targetQuoteId) {
    const existingById = db.repairQuotes.find((q) => q.id === targetQuoteId);
    if (!existingById) {
      return res.status(404).json({ error: 'Specified quote not found.' });
    }
    if (existingById.technicianId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden: You cannot modify another technician's quote." });
    }
    if (existingById.status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Cannot modify an accepted quote.' });
    }
  }

  // Check for existing quote from this technician on this request
  const existingQuote = db.repairQuotes.find(
    (q) => q.requestId === requestId && q.technicianId === req.user!.id
  );

  if (existingQuote && existingQuote.status === 'ACCEPTED') {
    return res.status(400).json({ error: 'Cannot modify an accepted quote.' });
  }

  const quoteId = existingQuote ? existingQuote.id : `quote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();
  const validityDaysVal = typeof validityDays === 'number' && validityDays >= 1 && validityDays <= 30 ? validityDays : 7;
  const expiresAt = new Date(now.getTime() + validityDaysVal * 24 * 60 * 60 * 1000).toISOString();

  const quote = {
    id: quoteId,
    requestId,
    technicianId: req.user!.id,
    technicianName: user.name,
    businessName: tech.businessName,
    technicianPhone: user.phone,
    technicianAvatar: user.avatarUrl,
    technicianRating: tech.rating,
    technicianReviewsCount: tech.reviewCount,
    distanceKm: Math.round((distanceKm || 0) * 10) / 10,
    items: resolvedLineItems,
    partsCost: serverCalculatedPartsCost,
    laborCost: laborVal.value,
    diagnosticCost: diagnosticVal.value,
    otherCost: otherVal.value,
    totalAmount,
    estimatedTimeHours: hoursVal.value,
    warrantyDays: Math.max(warrantyVal.value, serverMaxWarrantyDays),
    partsQuality: resolvedQuality,
    notes: sanitizeString(notes || '', 1000),
    limitationsOrConditions: sanitizeString(limitationsOrConditions || '', 1000),
    expiresAt,
    status: 'SUBMITTED' as const,
    priceAuditMetadata,
    createdAt: existingQuote ? existingQuote.createdAt : now.toISOString(),
    updatedAt: now.toISOString(),
  };

  if (existingQuote) {
    Object.assign(existingQuote, quote);
  } else {
    db.repairQuotes.push(quote);
    request.quotesCount = (request.quotesCount || 0) + 1;
  }

  request.status = 'QUOTING';
  request.updatedAt = now.toISOString();

  // Notify customer
  NotificationService.send({
    userId: request.customerId,
    title: 'New Quote Received!',
    message: `${tech.businessName} submitted a quote of ₦${totalAmount.toLocaleString()} (${quote.warrantyDays} days warranty) for your ${request.deviceBrand} ${request.deviceModel}.`,
    type: 'QUOTE',
    repairId: request.id,
  });

  // Notify technician confirming quote submission
  NotificationService.send({
    userId: req.user!.id,
    title: 'Quote Submitted Successfully',
    message: `Your quote of ₦${totalAmount.toLocaleString()} for ${request.deviceBrand} ${request.deviceModel} has been sent to the customer.`,
    type: 'QUOTE',
    repairId: request.id,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'technician',
    action: 'QUOTE_SUBMITTED',
    resourceType: 'REPAIR_QUOTE',
    resourceId: quoteId,
    details: {
      requestId,
      totalAmount,
      partsCost: serverCalculatedPartsCost,
      laborCost: laborVal.value,
      partsQuality: resolvedQuality,
      lineItemsCount: resolvedLineItems.length,
    },
  });

  db.save();
  return res.status(201).json(quote);
});

apiRouter.get('/repairs/requests/:id/quotes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.repairRequests.find((r) => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }

  if (req.user!.role === 'customer') {
    // IDOR protection: Customer can only view quotes for their own requests
    if (request.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden: You cannot access quotes for another customer request.' });
    }

    const quotes = db.repairQuotes.filter((q) => q.requestId === request.id);
    const now = Date.now();

    // Check expiration on pending/submitted quotes
    quotes.forEach((q) => {
      if ((q.status === 'PENDING' || q.status === 'SUBMITTED') && q.expiresAt && new Date(q.expiresAt).getTime() < now) {
        q.status = 'EXPIRED';
        q.updatedAt = new Date().toISOString();
      }
    });
    db.save();

    return res.json(paginate(req, res, quotes.map((q) => sanitizeQuoteForCustomer(q, req.user!.id))));
  } else if (req.user!.role === 'technician') {
    // Technician only sees their own quote for this request
    const quotes = db.repairQuotes.filter((q) => q.requestId === request.id && q.technicianId === req.user!.id);
    return res.json(paginate(req, res, quotes));
  }

  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.get('/quotes/my-quotes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'technician') {
    const quotes = db.repairQuotes.filter((q) => q.technicianId === req.user!.id);
    const quotesWithRequests = quotes.map((q) => {
      const request = db.repairRequests.find((r) => r.id === q.requestId);
      return {
        ...q,
        request: request
          ? sanitizeRepairRequestForTechnician(request, req.user!.id, quotes)
          : undefined,
      };
    });
    return res.json(paginate(req, res, quotesWithRequests));
  } else if (req.user!.role === 'customer') {
    const customerRequests = db.repairRequests.filter((r) => r.customerId === req.user!.id);
    const requestIds = new Set(customerRequests.map((r) => r.id));
    const quotes = db.repairQuotes.filter((q) => requestIds.has(q.requestId));
    return res.json(paginate(req, res, quotes.map((q) => sanitizeQuoteForCustomer(q, req.user!.id))));
  }
  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.post('/quotes/:id/withdraw', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const quote = db.repairQuotes.find((q) => q.id === req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quote not found.' });
  }

  // IDOR Protection: Technician can only withdraw their own quote
  if (quote.technicianId !== req.user!.id) {
    return res.status(403).json({ error: "Forbidden: You cannot modify another technician's quote." });
  }

  if (quote.status === 'ACCEPTED') {
    return res.status(400).json({ error: 'Cannot withdraw an accepted quote.' });
  }

  quote.status = 'WITHDRAWN';
  quote.updatedAt = new Date().toISOString();
  db.save();

  return res.json({ success: true, quote });
});

apiRouter.post('/quotes/:id/reject', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const quote = db.repairQuotes.find((q) => q.id === req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quote not found.' });
  }

  const request = db.repairRequests.find((r) => r.id === quote.requestId);
  if (!request || request.customerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: You cannot reject a quote for another customer request.' });
  }

  if (quote.status === 'ACCEPTED') {
    return res.status(400).json({ error: 'Cannot reject an accepted quote.' });
  }

  quote.status = 'REJECTED';
  quote.updatedAt = new Date().toISOString();
  db.save();

  return res.json({ success: true, quote });
});

apiRouter.post('/quotes/accept', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { requestId, quoteId } = req.body;
  if (!isNonEmptyString(requestId) || !isNonEmptyString(quoteId)) {
    return res.status(400).json({ error: 'Request ID and Quote ID are required.' });
  }

  const result = RepairWorkflowService.acceptQuote({
    requestId,
    quoteId,
    customerId: req.user!.id,
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

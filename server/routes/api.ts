import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { AuthService } from '../services/authService';
import { TechnicianMatchingService } from '../services/technicianMatchingService';
import { PaymentService } from '../services/paymentService';
import { RepairWorkflowService } from '../services/repairWorkflowService';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { UserRole, RepairLifecycleStatus, ConditionReport } from '../../src/types/index';

export const apiRouter = Router();

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    isBorrowedDevice?: boolean;
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required.' });
  }

  const token = authHeader.substring(7);
  const session = AuthService.verifyToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
  }

  req.user = session;
  next();
}

function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role.` });
    }
    next();
  };
}

/* -------------------------------------------------------------
 * 1. AUTHENTICATION & SESSIONS
 * ----------------------------------------------------------- */
apiRouter.post('/auth/register-customer', (req: Request, res: Response) => {
  const { name, phone, email, password, address, landmark, city, state, isBorrowedDevice } = req.body;
  if (!name || !phone || !email) {
    return res.status(400).json({ error: 'Name, phone, and email are required.' });
  }

  const result = AuthService.registerCustomer({
    name,
    phone,
    email,
    password,
    address,
    landmark,
    city,
    state,
    isBorrowedDevice,
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/auth/register-technician', (req: Request, res: Response) => {
  const { name, phone, email, businessName, password, shopAddress, landmark, area, city, state, supportedBrands } = req.body;
  if (!name || !phone || !email || !businessName || !shopAddress) {
    return res.status(400).json({ error: 'Name, phone, email, business name, and shop address are required.' });
  }

  const result = AuthService.registerTechnician({
    name,
    phone,
    email,
    businessName,
    password,
    shopAddress,
    landmark,
    area,
    city,
    state,
    supportedBrands,
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { emailOrPhone, password, isBorrowedDevice } = req.body;
  if (!emailOrPhone) {
    return res.status(400).json({ error: 'Email or phone is required.' });
  }

  const result = AuthService.login(emailOrPhone, password, !!isBorrowedDevice);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const session = AuthService.getUserSession(req.user!.id);
  if (!session) {
    return res.status(404).json({ error: 'User session not found.' });
  }
  return res.json(session);
});

/* -------------------------------------------------------------
 * 2. DEVICES & CATALOG
 * ----------------------------------------------------------- */
apiRouter.get('/devices/brands', (_req: Request, res: Response) => {
  return res.json(db.deviceBrands);
});

apiRouter.get('/devices/models', (req: Request, res: Response) => {
  const brandId = req.query.brandId as string;
  if (brandId) {
    return res.json(db.deviceModels.filter((m) => m.brandId === brandId));
  }
  return res.json(db.deviceModels);
});

apiRouter.get('/devices/issues', (_req: Request, res: Response) => {
  return res.json(db.repairIssues);
});

/* -------------------------------------------------------------
 * 3. TECHNICIAN DISCOVERY & MATCHING
 * ----------------------------------------------------------- */
apiRouter.get('/technicians', (_req: Request, res: Response) => {
  return res.json(db.technicianProfiles);
});

apiRouter.get('/technicians/:id', (req: Request, res: Response) => {
  const tech = db.technicianProfiles.find((t) => t.userId === req.params.id);
  if (!tech) {
    return res.status(404).json({ error: 'Technician not found.' });
  }
  const parts = db.technicianParts.filter((p) => p.technicianId === tech.userId);
  const reviews = db.reviews.filter((r) => r.technicianId === tech.userId);
  return res.json({ technician: tech, parts, reviews });
});

apiRouter.post('/technicians/match', (req: Request, res: Response) => {
  const { customerLocation, deviceBrand, deviceModel, issues, maxDistanceKm } = req.body;
  if (!customerLocation || !customerLocation.lat || !customerLocation.lng) {
    return res.status(400).json({ error: 'Valid customer location coordinates are required.' });
  }

  const results = TechnicianMatchingService.matchTechnicians({
    customerLocation,
    deviceBrand: deviceBrand || 'Other',
    deviceModel,
    issues: issues || [],
    maxDistanceKm: maxDistanceKm ? Number(maxDistanceKm) : 30,
  });

  return res.json(results);
});

/* -------------------------------------------------------------
 * 4. REPAIR REQUESTS & QUOTING
 * ----------------------------------------------------------- */
apiRouter.post('/repairs/requests', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { customerLocation, deviceBrand, deviceModel, issues, description, photos, voiceNoteUrl } = req.body;
  if (!customerLocation || !deviceBrand || !deviceModel || !issues || issues.length === 0) {
    return res.status(400).json({ error: 'Location, device brand, model, and at least one issue are required.' });
  }

  const user = db.users.find((u) => u.id === req.user!.id);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const request = {
    id: requestId,
    customerId: req.user!.id,
    customerName: user?.name || 'Customer',
    customerPhone: user?.phone || '',
    customerLocation,
    deviceBrand,
    deviceModel,
    issues,
    description: description || '',
    photos: photos || [],
    voiceNoteUrl,
    status: 'REQUESTED' as RepairLifecycleStatus,
    quotesCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.repairRequests.unshift(request);

  // Notify matching nearby technicians
  const matched = TechnicianMatchingService.matchTechnicians({
    customerLocation,
    deviceBrand,
    deviceModel,
    issues,
    maxDistanceKm: 25,
  });

  for (const match of matched.slice(0, 5)) {
    NotificationService.send({
      userId: match.technicianId,
      title: 'New Nearby Repair Request',
      message: `New request: ${deviceBrand} ${deviceModel} (${issues.join(', ')}) at ${customerLocation.area || customerLocation.city} (~${match.distanceKm} km). Send a quote!`,
      type: 'QUOTE',
      repairId: requestId,
    });
  }

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'customer',
    action: 'REPAIR_REQUEST_CREATED',
    resourceType: 'REPAIR_REQUEST',
    resourceId: requestId,
    details: { deviceBrand, deviceModel, issuesCount: issues.length },
  });

  db.save();
  return res.status(201).json(request);
});

apiRouter.get('/repairs/requests', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    const requests = db.repairRequests.filter((r) => r.customerId === req.user!.id);
    return res.json(requests);
  } else if (req.user!.role === 'technician') {
    // Return requests within technician's territory or active requests
    const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
    if (!tech) return res.json([]);
    const requests = db.repairRequests.filter((r) => r.status === 'REQUESTED' || r.status === 'QUOTING');
    return res.json(requests);
  }
  return res.json(db.repairRequests);
});

apiRouter.get('/repairs/requests/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.repairRequests.find((r) => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }
  const quotes = db.repairQuotes.filter((q) => q.requestId === request.id);
  return res.json({ request, quotes });
});

/* -------------------------------------------------------------
 * 5. TECHNICIAN QUOTES
 * ----------------------------------------------------------- */
apiRouter.post('/quotes/submit', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { requestId, partsCost, laborCost, otherCost, estimatedTimeHours, warrantyDays, partsQuality, notes } = req.body;
  if (!requestId || partsCost === undefined || laborCost === undefined) {
    return res.status(400).json({ error: 'Request ID, parts cost, and labor cost are required.' });
  }

  const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
  const user = db.users.find((u) => u.id === req.user!.id);
  const request = db.repairRequests.find((r) => r.id === requestId);

  if (!tech || !user || !request) {
    return res.status(404).json({ error: 'Technician profile or repair request not found.' });
  }

  const parts = Number(partsCost) || 0;
  const labor = Number(laborCost) || 0;
  const other = Number(otherCost) || 0;
  const total = parts + labor + other;

  const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

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
    distanceKm: 2.5,
    partsCost: parts,
    laborCost: labor,
    otherCost: other,
    totalAmount: total,
    estimatedTimeHours: Number(estimatedTimeHours) || 2,
    warrantyDays: Number(warrantyDays) || 60,
    partsQuality: partsQuality || 'PREMIUM_AFTERMARKET',
    notes: notes || '',
    status: 'PENDING' as const,
    createdAt: now,
  };

  db.repairQuotes.push(quote);
  request.quotesCount = (request.quotesCount || 0) + 1;
  request.status = 'QUOTING';

  NotificationService.send({
    userId: request.customerId,
    title: 'New Quote Received!',
    message: `${tech.businessName} submitted a quote of ₦${total.toLocaleString()} (${quote.warrantyDays} days warranty) for your ${request.deviceBrand} ${request.deviceModel}.`,
    type: 'QUOTE',
    repairId: request.id,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'technician',
    action: 'QUOTE_SUBMITTED',
    resourceType: 'REPAIR_QUOTE',
    resourceId: quoteId,
    details: { requestId, totalAmount: total, partsQuality },
  });

  db.save();
  return res.status(201).json(quote);
});

apiRouter.post('/quotes/accept', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { requestId, quoteId } = req.body;
  if (!requestId || !quoteId) {
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

/* -------------------------------------------------------------
 * 6. PAYMENTS & ESCROW
 * ----------------------------------------------------------- */
apiRouter.post('/payments/create-intent', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { repairJobId, idempotencyKey, paymentMethod } = req.body;
  if (!repairJobId || !idempotencyKey) {
    return res.status(400).json({ error: 'Repair Job ID and Idempotency Key are required.' });
  }

  const result = PaymentService.createPaymentIntent({
    repairJobId,
    customerId: req.user!.id,
    idempotencyKey,
    paymentMethod,
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/payments/verify-mock', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { paymentId, transactionRef } = req.body;
  if (!paymentId && !transactionRef) {
    return res.status(400).json({ error: 'Payment ID or Transaction Reference required.' });
  }

  const result = PaymentService.verifyAndHoldInEscrow({
    paymentId,
    transactionRef,
    actorId: req.user!.id,
    actorRole: req.user!.role,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

/* -------------------------------------------------------------
 * 7. REPAIR JOBS & WORKFLOW
 * ----------------------------------------------------------- */
apiRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    const jobs = db.repairJobs.filter((j) => j.customerId === req.user!.id);
    return res.json(jobs);
  } else if (req.user!.role === 'technician') {
    const jobs = db.repairJobs.filter((j) => j.technicianId === req.user!.id);
    return res.json(jobs);
  }
  return res.json(db.repairJobs);
});

apiRouter.get('/jobs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  // Check authorization
  if (req.user!.role === 'customer' && job.customerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access to another customer’s repair is prohibited.' });
  }
  if (req.user!.role === 'technician' && job.technicianId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access to another technician’s repair is prohibited.' });
  }

  const customer = db.users.find((u) => u.id === job.customerId);
  const technician = db.technicianProfiles.find((t) => t.userId === job.technicianId);
  const payment = db.payments.find((p) => p.repairId === job.id);
  const quote = db.repairQuotes.find((q) => q.id === job.quoteId);

  return res.json({
    job,
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, avatarUrl: customer.avatarUrl } : null,
    technician,
    payment,
    quote,
  });
});

apiRouter.post('/jobs/:id/check-in', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const report = req.body.report as ConditionReport;
  if (!report || !report.frontCondition) {
    return res.status(400).json({ error: 'Physical condition assessment report required.' });
  }

  const result = RepairWorkflowService.checkInDevice({
    jobId: req.params.id,
    technicianId: req.user!.id,
    report,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.patch('/jobs/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { newStatus, note } = req.body;
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  // Role validation
  if (req.user!.role === 'technician' && job.technicianId !== req.user!.id) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }
  if (req.user!.role === 'customer' && job.customerId !== req.user!.id) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const valid = RepairWorkflowService.isValidTransition(job.status, newStatus);
  if (!valid) {
    return res.status(400).json({
      error: `Invalid state transition from ${job.status} to ${newStatus}.`,
    });
  }

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
    note: note || `Status updated to ${newStatus}`,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: `STATUS_CHANGED_${newStatus}`,
    resourceType: 'REPAIR_JOB',
    resourceId: job.id,
    details: { oldStatus: job.status, newStatus, note },
  });

  db.save();
  return res.json(job);
});

apiRouter.post('/jobs/:id/add-part', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { partName, deviceModel, quality, priceNaira, warrantyDays, supplier, beforePhotoUrl, afterPhotoUrl } = req.body;
  if (!partName || priceNaira === undefined) {
    return res.status(400).json({ error: 'Part name and price are required.' });
  }

  const result = RepairWorkflowService.addPartUsed({
    jobId: req.params.id,
    technicianId: req.user!.id,
    part: {
      partName,
      deviceModel: deviceModel || 'Standard',
      quality: quality || 'PREMIUM_AFTERMARKET',
      priceNaira: Number(priceNaira),
      warrantyDays: Number(warrantyDays) || 60,
      supplier,
      beforePhotoUrl,
      afterPhotoUrl,
    },
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/jobs/:id/additional-diagnosis', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { title, description, additionalCostNaira, photoEvidence } = req.body;
  if (!title || additionalCostNaira === undefined) {
    return res.status(400).json({ error: 'Title and additional cost are required.' });
  }

  const result = RepairWorkflowService.submitAdditionalDiagnosis({
    jobId: req.params.id,
    technicianId: req.user!.id,
    title,
    description: description || '',
    additionalCostNaira: Number(additionalCostNaira),
    photoEvidence: photoEvidence || [],
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
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

/* -------------------------------------------------------------
 * 8. REVIEWS & RATINGS (One Repair = One Review)
 * ----------------------------------------------------------- */
apiRouter.post('/reviews', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { repairId, rating, comment } = req.body;
  if (!repairId || !rating) {
    return res.status(400).json({ error: 'Repair ID and rating (1-5) are required.' });
  }

  const numRating = Number(rating);
  if (numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  const job = db.repairJobs.find((j) => j.id === repairId);
  if (!job) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  if (job.customerId !== req.user!.id) {
    return res.status(403).json({ error: 'Unauthorized: You can only rate your own repair.' });
  }

  if (job.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'You can only review after the repair is completed.' });
  }

  // Prevent duplicate reviews
  const existing = db.reviews.find((r) => r.repairId === repairId && r.customerId === req.user!.id);
  if (existing) {
    return res.status(400).json({ error: 'You have already reviewed this repair transaction.' });
  }

  const user = db.users.find((u) => u.id === req.user!.id);
  const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const review = {
    id: reviewId,
    repairId,
    customerId: req.user!.id,
    customerName: user?.name || 'Customer',
    technicianId: job.technicianId,
    rating: numRating,
    comment: comment || '',
    verifiedPurchase: true as const,
    repairSummary: `${job.deviceBrand} ${job.deviceModel} (${job.issues.join(', ')})`,
    createdAt: now,
  };

  db.reviews.push(review);

  // Recalculate technician rating average
  const techReviews = db.reviews.filter((r) => r.technicianId === job.technicianId);
  const avg = techReviews.reduce((sum, r) => sum + r.rating, 0) / techReviews.length;
  const tech = db.technicianProfiles.find((t) => t.userId === job.technicianId);
  if (tech) {
    tech.rating = Math.round(avg * 10) / 10;
    tech.reviewCount = techReviews.length;
  }

  NotificationService.send({
    userId: job.technicianId,
    title: 'New Customer Review!',
    message: `${user?.name || 'Customer'} rated your service ${numRating} stars: "${comment ? comment.substring(0, 50) + '...' : 'Great job!'}"`,
    type: 'STATUS_CHANGE',
    repairId: job.id,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'customer',
    action: 'REVIEW_SUBMITTED',
    resourceType: 'REVIEW',
    resourceId: reviewId,
    details: { rating: numRating, technicianId: job.technicianId },
  });

  db.save();
  return res.status(201).json(review);
});

apiRouter.get('/reviews/technician/:id', (req: Request, res: Response) => {
  const reviews = db.reviews.filter((r) => r.technicianId === req.params.id);
  return res.json(reviews);
});

/* -------------------------------------------------------------
 * 9. PARTS CATALOG & TECHNICIAN SETTINGS
 * ----------------------------------------------------------- */
apiRouter.get('/parts/technician/:id', (req: Request, res: Response) => {
  const parts = db.technicianParts.filter((p) => p.technicianId === req.params.id);
  return res.json(parts);
});

apiRouter.post('/parts', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { name, partName, deviceBrand, deviceModel, quality, priceNaira, inStockCount, stockQuantity, warrantyDays, photoUrl } = req.body;
  const resolvedName = name || partName;
  if (!resolvedName || priceNaira === undefined) {
    return res.status(400).json({ error: 'Part name and price are required.' });
  }

  const resolvedStock = inStockCount !== undefined ? Number(inStockCount) : (stockQuantity !== undefined ? Number(stockQuantity) : 5);

  const part = {
    id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    technicianId: req.user!.id,
    name: resolvedName,
    partName: resolvedName,
    deviceBrand: deviceBrand || 'All',
    deviceModel: deviceModel || 'All Models',
    quality: quality || 'PREMIUM_AFTERMARKET',
    priceNaira: Number(priceNaira),
    inStockCount: resolvedStock,
    stockQuantity: resolvedStock,
    warrantyDays: warrantyDays !== undefined ? Number(warrantyDays) : 60,
    photoUrl,
  };

  db.technicianParts.push(part);
  db.save();
  return res.status(201).json(part);
});

apiRouter.put('/technicians/profile', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!tech || !user) return res.status(404).json({ error: 'Technician not found.' });

  const { businessName, bio, shopLocation, businessHours, phone, supportedBrands, bankDetails } = req.body;
  if (businessName) {
    tech.businessName = businessName;
    user.name = businessName;
  }
  if (bio !== undefined) tech.bio = bio;
  if (businessHours) tech.businessHours = businessHours;
  if (phone) {
    tech.phone = phone;
    user.phone = phone;
  }
  if (supportedBrands) tech.supportedBrands = supportedBrands;
  if (shopLocation) {
    tech.shopLocation = {
      ...tech.shopLocation,
      ...shopLocation,
    };
  }
  if (bankDetails) {
    tech.bankDetails = {
      bankName: bankDetails.bankName || 'Access Bank',
      accountNumber: bankDetails.accountNumber || '',
      accountName: bankDetails.accountName || businessName || user.name,
      verified: true,
    };
    tech.verificationStatus.payoutVerified = true;
  }

  db.save();
  return res.json({ success: true, profile: tech, user });
});

apiRouter.post('/technicians/availability', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!status || !['AVAILABLE', 'BUSY', 'OFFLINE'].includes(status)) {
    return res.status(400).json({ error: 'Status must be AVAILABLE, BUSY, or OFFLINE.' });
  }

  const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
  if (!tech) return res.status(404).json({ error: 'Technician profile not found.' });

  tech.availability = status;
  db.save();
  return res.json({ success: true, availability: status });
});

/* -------------------------------------------------------------
 * 10. NOTIFICATIONS & MESSAGING
 * ----------------------------------------------------------- */
apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifs = db.notifications.filter((n) => n.userId === req.user!.id);
  return res.json(notifs);
});

apiRouter.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  NotificationService.markAsRead(req.params.id, req.user!.id);
  return res.json({ success: true });
});

apiRouter.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const count = NotificationService.markAllAsRead(req.user!.id);
  return res.json({ success: true, count });
});

apiRouter.get('/messages/:repairId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const messages = db.messages.filter((m) => m.repairId === req.params.repairId);
  return res.json(messages);
});

apiRouter.post('/messages/:repairId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { text, attachmentUrl } = req.body;
  if (!text && !attachmentUrl) {
    return res.status(400).json({ error: 'Message text or attachment is required.' });
  }

  const user = db.users.find((u) => u.id === req.user!.id);
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    repairId: req.params.repairId,
    senderId: req.user!.id,
    senderRole: req.user!.role,
    senderName: user?.name || 'User',
    text: text || '',
    attachmentUrl,
    createdAt: new Date().toISOString(),
  };

  db.messages.push(msg);
  db.save();
  return res.status(201).json(msg);
});

/* -------------------------------------------------------------
 * 11. WARRANTIES & AUDIT LOGS
 * ----------------------------------------------------------- */
apiRouter.get('/warranties/my-warranties', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const jobs = db.repairJobs.filter((j) => j.customerId === req.user!.id);
  const jobIds = jobs.map((j) => j.id);
  const warranties = db.warranties.filter((w) => jobIds.includes(w.repairJobId));
  return res.json(warranties);
});

apiRouter.get('/audit-logs/repair/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const logs = AuditService.getLogsForResource(req.params.id);
  return res.json(logs);
});

/* -------------------------------------------------------------
 * 12. DEMO / TEST RESET
 * ----------------------------------------------------------- */
apiRouter.post('/dev/reset-seed', (_req: Request, res: Response) => {
  db.resetToSeed();
  return res.json({ success: true, message: 'Database reset to initial test seed data.' });
});

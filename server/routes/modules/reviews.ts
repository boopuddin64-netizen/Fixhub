import { Request, Response } from 'express';
import { db } from '../../db';
import { AuditService } from '../../services/auditService';
import { NotificationService } from '../../services/notificationService';
import { paginate } from '../../utils/pagination';
import { isNonEmptyString, sanitizeString, validateNumber } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole } from './shared';

/* -------------------------------------------------------------
 * 8. REVIEWS & RATINGS (One Completed Repair = One Review)
 * ----------------------------------------------------------- */
apiRouter.post('/reviews', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { repairId, rating, comment } = req.body;

  if (!isNonEmptyString(repairId)) {
    return res.status(400).json({ error: 'Repair Job ID is required.' });
  }

  const ratingVal = validateNumber(rating, 'Rating', { min: 1, max: 5, integerOnly: true });
  if (ratingVal.valid === false) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  const job = db.repairJobs.find((j) => j.id === repairId);
  if (!job || job.customerId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  if (job.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'You can only review after the repair is completed and confirmed.' });
  }

  // Prevent duplicate review per repair
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
    technicianId: job.technicianId, // Server-derived from job record
    rating: ratingVal.value,
    comment: sanitizeString(comment, 1000),
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
    message: `${user?.name || 'Customer'} rated your service ${ratingVal.value} stars: "${review.comment ? review.comment.substring(0, 50) + '...' : 'Great job!'}"`,
    type: 'STATUS_CHANGE',
    repairId: job.id,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'customer',
    action: 'REVIEW_SUBMITTED',
    resourceType: 'REVIEW',
    resourceId: reviewId,
    details: { rating: ratingVal.value, technicianId: job.technicianId },
  });

  db.save();
  return res.status(201).json(review);
});

apiRouter.get('/reviews/technician/:id', (req: Request, res: Response) => {
  const reviews = db.reviews.filter((r) => r.technicianId === req.params.id);
  return res.json(paginate(req, res, reviews));
});

apiRouter.get('/reviews/my-reviews', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const reviews = db.reviews.filter((r) => r.customerId === req.user!.id);
  return res.json(paginate(req, res, reviews));
});

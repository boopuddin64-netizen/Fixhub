import { Response } from 'express';
import { db } from '../../db';
import { AuditService } from '../../services/auditService';
import { NotificationService } from '../../services/notificationService';
import { paginate } from '../../utils/pagination';
import { isNonEmptyString, sanitizeString } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth } from './shared';

/* -------------------------------------------------------------
 * 10. NOTIFICATIONS & MESSAGING (Strict Recipient Authorization)
 * ----------------------------------------------------------- */
apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  // Always filter strictly by authenticated user's ID, ignoring query parameters
  const notifs = db.notifications.filter((n) => n.userId === req.user!.id);
  return res.json(paginate(req, res, notifs));
});

apiRouter.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notifId = req.params.id;
  const userId = req.user!.id;
  const notif = db.notifications.find((n) => n.id === notifId);

  // Idempotent: If notification does not exist or belongs to another user, respond safely
  if (!notif || notif.userId !== userId) {
    return res.json({ success: true, updated: false });
  }

  NotificationService.markAsRead(notifId, userId);
  return res.json({ success: true, updated: true });
});

apiRouter.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const count = NotificationService.markAllAsRead(req.user!.id);
  return res.json({ success: true, count });
});

apiRouter.get('/messages/:repairId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const repairId = req.params.repairId;

  // Verify caller is an authorized participant in the repair
  const job = db.repairJobs.find((j) => j.id === repairId);
  const request = db.repairRequests.find((r) => r.id === repairId);

  let isParticipant = false;

  if (job) {
    if (job.customerId === req.user!.id || job.technicianId === req.user!.id) {
      isParticipant = true;
    }
  } else if (request) {
    if (request.customerId === req.user!.id) {
      isParticipant = true;
    } else if (req.user!.role === 'technician') {
      const hasQuoted = db.repairQuotes.some((q) => q.requestId === request.id && q.technicianId === req.user!.id);
      const isSelected = request.selectedTechnicianId === req.user!.id;
      if (hasQuoted || isSelected) {
        isParticipant = true;
      }
    }
  }

  if (!isParticipant) {
    return res.status(404).json({ error: 'Repair conversation not found or access denied.' });
  }

  const messages = db.messages.filter((m) => m.repairId === repairId);
  return res.json(paginate(req, res, messages, { defaultLimit: 1000, maxLimit: 1000 }));
});

apiRouter.post('/messages/:repairId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const repairId = req.params.repairId;
  const { text, attachmentUrl } = req.body;

  if (!isNonEmptyString(text) && !isNonEmptyString(attachmentUrl)) {
    return res.status(400).json({ error: 'Message text or attachment is required.' });
  }

  // Verify caller is an authorized participant in the repair
  const job = db.repairJobs.find((j) => j.id === repairId);
  const request = db.repairRequests.find((r) => r.id === repairId);

  let isParticipant = false;

  if (job) {
    if (job.customerId === req.user!.id || job.technicianId === req.user!.id) {
      isParticipant = true;
    }
  } else if (request) {
    if (request.customerId === req.user!.id) {
      isParticipant = true;
    } else if (req.user!.role === 'technician') {
      const hasQuoted = db.repairQuotes.some((q) => q.requestId === request.id && q.technicianId === req.user!.id);
      const isSelected = request.selectedTechnicianId === req.user!.id;
      if (hasQuoted || isSelected) {
        isParticipant = true;
      }
    }
  }

  if (!isParticipant) {
    return res.status(404).json({ error: 'Repair conversation not found or access denied.' });
  }

  const user = db.users.find((u) => u.id === req.user!.id);
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    repairId,
    senderId: req.user!.id,
    senderRole: req.user!.role,
    senderName: user?.name || (req.user!.role === 'technician' ? 'Technician' : 'Customer'),
    text: sanitizeString(text, 2000),
    attachmentUrl: attachmentUrl ? sanitizeString(attachmentUrl, 500) : undefined,
    createdAt: new Date().toISOString(),
  };

  db.messages.push(msg);
  db.save();
  return res.status(201).json(msg);
});

/* -------------------------------------------------------------
 * 11. WARRANTIES & AUDIT LOGS (Strict Access Boundaries)
 * ----------------------------------------------------------- */
apiRouter.get('/warranties/my-warranties', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    const jobs = db.repairJobs.filter((j) => j.customerId === req.user!.id);
    const jobIds = jobs.map((j) => j.id);
    const warranties = db.warranties.filter((w) => jobIds.includes(w.repairJobId));
    return res.json(paginate(req, res, warranties));
  } else if (req.user!.role === 'technician') {
    const warranties = db.warranties.filter((w) => w.technicianId === req.user!.id);
    return res.json(paginate(req, res, warranties));
  }
  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.get('/audit-logs/repair/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const resourceId = req.params.id;

  // Verify caller is an authorized participant
  const job = db.repairJobs.find((j) => j.id === resourceId);
  const request = db.repairRequests.find((r) => r.id === resourceId);

  let isAuthorized = false;

  if (job) {
    if (job.customerId === req.user!.id || job.technicianId === req.user!.id) {
      isAuthorized = true;
    }
  } else if (request) {
    if (request.customerId === req.user!.id || request.selectedTechnicianId === req.user!.id) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return res.status(404).json({ error: 'Audit log not found or access denied.' });
  }

  const logs = AuditService.getLogsForResource(resourceId);
  return res.json(logs);
});

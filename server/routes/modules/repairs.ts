import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { TechnicianMatchingService } from '../../services/technicianMatchingService';
import { RepairWorkflowService } from '../../services/repairWorkflowService';
import { AuditService } from '../../services/auditService';
import { NotificationService } from '../../services/notificationService';
import { calculateDistanceKm } from '../../services/technicianMatchingService';
import { paginate } from '../../utils/pagination';
import { RepairLifecycleStatus, RepairRequest } from '../../../src/types/index';
import { isNonEmptyString, sanitizeString, isValidCoordinates, sanitizeRepairRequestForTechnician, validateCustomerLocationPayload } from '../../utils/validation';
import { geocodeCustomerLocation, apiRouter, AuthenticatedRequest, requireAuth, requireRole, sanitizeTechnicianForPublic, sanitizeQuoteForCustomer } from './shared';

/* -------------------------------------------------------------
 * 4. REPAIR REQUESTS, DRAFTS & QUOTING (Strict Role & Ownership Isolation)
 * ----------------------------------------------------------- */

// 4.0 Repair Issues Catalog
apiRouter.get('/repairs/issues', (req: Request, res: Response) => {
  const category = req.query.category as string;
  let issues = db.repairIssueCatalog.filter((i) => i.isActive);
  if (category) {
    issues = issues.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  }
  return res.json(issues);
});

// 4.1 Repair Drafts (Customer Persistence)
apiRouter.get('/repairs/draft', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const draft = db.drafts.find((d) => d.customerId === req.user!.id);
  return res.json(draft || null);
});

apiRouter.post('/repairs/draft', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const {
    deviceBrand,
    deviceModel,
    deviceModelId,
    deviceType,
    catalogMatch,
    issues,
    otherDescription,
    description,
    voiceNoteUrl,
    voiceNoteDurationSeconds,
    photos,
    attachments,
    customerLocation,
    step,
  } = req.body;

  const now = new Date().toISOString();
  let draft = db.drafts.find((d) => d.customerId === req.user!.id);

  if (!draft) {
    draft = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customerId: req.user!.id,
      updatedAt: now,
    };
    db.drafts.push(draft);
  }

  if (deviceBrand !== undefined) draft.deviceBrand = sanitizeString(deviceBrand, 80);
  if (deviceModel !== undefined) draft.deviceModel = sanitizeString(deviceModel, 80);
  if (deviceModelId !== undefined) draft.deviceModelId = sanitizeString(deviceModelId, 80);
  if (deviceType !== undefined) draft.deviceType = deviceType === 'TABLET' ? 'TABLET' : 'PHONE';
  if (catalogMatch !== undefined) draft.catalogMatch = Boolean(catalogMatch);
  if (Array.isArray(issues)) draft.issues = issues.map((i) => sanitizeString(i, 80));
  if (otherDescription !== undefined) draft.otherDescription = sanitizeString(otherDescription, 500);
  if (description !== undefined) draft.description = sanitizeString(description, 2000);
  if (voiceNoteUrl !== undefined) draft.voiceNoteUrl = sanitizeString(voiceNoteUrl, 1000);
  if (voiceNoteDurationSeconds !== undefined) draft.voiceNoteDurationSeconds = Number(voiceNoteDurationSeconds) || 0;
  if (Array.isArray(photos)) draft.photos = photos.filter((p) => typeof p === 'string').slice(0, 3);
  if (Array.isArray(attachments)) draft.attachments = attachments.slice(0, 4);
  if (step !== undefined) draft.step = Number(step);

  if (customerLocation && isValidCoordinates(customerLocation.lat, customerLocation.lng)) {
    draft.customerLocation = {
      lat: Number(customerLocation.lat),
      lng: Number(customerLocation.lng),
      address: sanitizeString(customerLocation.address, 200) || '',
      landmark: sanitizeString(customerLocation.landmark, 100),
      area: sanitizeString(customerLocation.area, 80),
      city: sanitizeString(customerLocation.city, 80) || customerLocation.area || '',
      state: sanitizeString(customerLocation.state, 80) || '',
    };
  }

  draft.updatedAt = now;
  db.save();

  return res.json(draft);
});

apiRouter.delete('/repairs/draft', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const draftIdx = db.drafts.findIndex((d) => d.customerId === req.user!.id);
  if (draftIdx !== -1) {
    db.drafts.splice(draftIdx, 1);
    db.save();
  }
  return res.json({ success: true, message: 'Draft cleared.' });
});

// 4.2 Attachment Upload (Base64 / Data URL to local file)
apiRouter.post('/repairs/attachments/upload', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { fileData, type, mimeType, size, durationSeconds } = req.body;

  if (!fileData || typeof fileData !== 'string') {
    return res.status(400).json({ error: 'fileData string is required.' });
  }

  if (type !== 'IMAGE' && type !== 'AUDIO') {
    return res.status(400).json({ error: "Attachment type must be 'IMAGE' or 'AUDIO'." });
  }

  // Max 8MB base64 payload size guard
  if (fileData.length > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds maximum permitted limit.' });
  }

  try {
    const attachId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const attachmentsDir = path.resolve(process.cwd(), './data/attachments');
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }

    let base64Payload = fileData.trim();
    let detectedMime = mimeType ? sanitizeString(mimeType, 100) : '';

    // Robustly extract base64 from Data URLs of any MIME type (e.g. data:audio/webm;codecs=opus;base64,...)
    if (base64Payload.startsWith('data:')) {
      const commaIndex = base64Payload.indexOf(',');
      if (commaIndex !== -1) {
        const header = base64Payload.substring(5, commaIndex);
        const base64MarkerIndex = header.indexOf(';base64');
        if (base64MarkerIndex !== -1) {
          const headerMime = header.substring(0, base64MarkerIndex).trim();
          if (headerMime && !detectedMime) {
            detectedMime = sanitizeString(headerMime, 100);
          }
        }
        base64Payload = base64Payload.substring(commaIndex + 1);
      }
    }

    // Strip any whitespace, linebreaks, or carriage returns from base64 payload
    base64Payload = base64Payload.replace(/\s+/g, '');

    // Validate base64 characters (supports standard and URL-safe base64: A-Z, a-z, 0-9, +, /, -, _, =)
    if (!base64Payload || !/^[A-Za-z0-9+/=_-]+$/.test(base64Payload)) {
      return res.status(400).json({ error: 'Invalid base64 format.' });
    }

    // Normalize URL-safe base64 to standard base64
    const normalizedBase64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(normalizedBase64, 'base64');

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Invalid base64 format.' });
    }

    // Determine extension based on type and detected MIME
    let attachExt = type === 'IMAGE' ? 'jpg' : 'webm';
    const lowerMime = (detectedMime || '').toLowerCase();
    if (type === 'IMAGE') {
      if (lowerMime.includes('png')) attachExt = 'png';
      else if (lowerMime.includes('webp')) attachExt = 'webp';
      else if (lowerMime.includes('gif')) attachExt = 'gif';
      else if (lowerMime.includes('svg')) attachExt = 'svg'; // rejected below
      else attachExt = 'jpg';
    } else if (type === 'AUDIO') {
      if (lowerMime.includes('mp4') || lowerMime.includes('m4a') || lowerMime.includes('aac')) attachExt = 'm4a';
      else if (lowerMime.includes('ogg') || lowerMime.includes('opus')) attachExt = 'ogg';
      else if (lowerMime.includes('wav')) attachExt = 'wav';
      else if (lowerMime.includes('3gp')) attachExt = '3gp';
      else attachExt = 'webm';
    }

    // SVG (and any markup) is an active-content format: it can carry script, event handlers, <animate>,
    // entity-encoded javascript: URLs, etc. A regex blacklist cannot make it safe, so SVG uploads are
    // rejected outright — by declared MIME/extension AND by sniffing the bytes (client MIME is untrusted).
    const head = buffer.subarray(0, 2048).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
    const looksLikeMarkup =
      head.startsWith('<') && (/<svg[\s>]/.test(head) || /<!doctype/.test(head) || /<html[\s>]/.test(head) || /<script[\s>]/.test(head) || /^<\?xml/.test(head));
    if (lowerMime.includes('svg') || lowerMime.includes('xml') || lowerMime.includes('html') || attachExt === 'svg' || looksLikeMarkup) {
      return res.status(415).json({
        error: 'SVG and markup files are not allowed. Please upload a JPEG, PNG, WebP or GIF image.',
      });
    }

    const filename = `${attachId}.${attachExt}`;
    fs.writeFileSync(path.join(attachmentsDir, filename), buffer);

    const attachment = {
      id: attachId,
      type: type as 'IMAGE' | 'AUDIO',
      url: `/api/repairs/attachments/${filename}`,
      mimeType: detectedMime || (type === 'IMAGE' ? 'image/jpeg' : 'audio/webm'),
      size: buffer.length || Number(size) || Math.round(base64Payload.length * 0.75),
      createdAt: new Date().toISOString(),
      durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
      ownerId: req.user!.id,
    };

    db.uploadedAttachments.push(attachment);
    db.save();

    return res.status(201).json(attachment);
  } catch (err) {
    console.error('Error saving attachment:', err);
    return res.status(500).json({ error: 'Failed to process attachment.' });
  }
});

apiRouter.get('/repairs/attachments/:filename', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename); // Prevent path traversal ../
  const attachmentsDir = path.resolve(process.cwd(), './data/attachments');
  const filePath = path.join(attachmentsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const userId = req.user!.id;
  const userRole = req.user!.role;

  let authorized = false;
  if (userRole === 'customer') {
    const ownsUpload = db.uploadedAttachments.some(
      (a) => a.ownerId === userId && a.url?.includes(safeFilename)
    );
    const ownsRequest = db.repairRequests.some(
      (r) => r.customerId === userId && (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename)))
    );
    const ownsDraft = db.drafts.some(
      (d) => d.customerId === userId && (d.photos?.some((p) => p.includes(safeFilename)) || d.attachments?.some((a) => a.url?.includes(safeFilename)))
    );
    authorized = ownsUpload || ownsRequest || ownsDraft;
  } else if (userRole === 'technician') {
    const isAssigned = db.repairJobs.some((j) => j.technicianId === userId && db.repairRequests.some((r) => r.id === j.requestId && (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename)))));
    const hasQuoted = db.repairQuotes.some((q) => q.technicianId === userId && db.repairRequests.some((r) => r.id === q.requestId && (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename)))));
    const tech = db.technicianProfiles.find(t => t.userId === userId) || (db.users.find(u => u.id === userId) ? AuthService.ensureTechnicianProfile(db.users.find(u => u.id === userId)!) : null);
    const isEligibleOpen = !!tech && db.repairRequests.some((r) => (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename))) && TechnicianMatchingService.isTechnicianEligible(tech, r).eligible);
    authorized = isAssigned || hasQuoted || isEligibleOpen;
  } else if (userRole === 'admin') {
    authorized = true;
  }

  if (!authorized) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to access this attachment.' });
  }

  // Uploads are untrusted user content: never let the browser sniff or render them as a document.
  const ext = path.extname(safeFilename).toLowerCase();
  const SAFE_TYPES: Record<string, string> = {
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.wav': 'audio/wav',
    '.3gp': 'audio/3gpp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  // Anything else (incl. legacy .svg files uploaded before this fix) is served as an opaque download.
  res.setHeader('Content-Type', SAFE_TYPES[ext] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'none'; script-src 'none'");
  res.setHeader('Cache-Control', 'private, max-age=0');

  res.sendFile(filePath);
});

apiRouter.post('/repairs/requests/:id/match', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.id;
  const requestId = req.params.id;
  const request = db.repairRequests.find((r) => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }

  if (request.customerId !== customerId) {
    return res.status(403).json({ error: 'Forbidden: You do not own this repair request (IDOR protection).' });
  }

  if (['CANCELLED', 'REFUNDED', 'COMPLETED'].includes(request.status)) {
    return res.status(400).json({ error: `Cannot perform technician discovery for request in status ${request.status}.` });
  }

  if (request.status === 'REQUESTED') {
    request.status = 'MATCHING';
    request.updatedAt = new Date().toISOString();
  }

  const rawMaxDistance = req.body?.maxDistanceKm !== undefined ? Number(req.body.maxDistanceKm) : 25;
  const maxDistanceKm = rawMaxDistance === 0 ? 500 : Math.min(Math.max(rawMaxDistance, 1), 500);
  const matched = TechnicianMatchingService.matchTechnicians({
    customerLocation: request.customerLocation,
    deviceBrand: request.deviceBrand,
    deviceModel: request.deviceModel,
    issues: request.issues,
    maxDistanceKm,
  });

  for (const match of matched.slice(0, 5)) {
    const alreadySent = db.notifications.some(
      (n) => n.userId === match.technicianId && n.repairId === requestId && n.type === 'QUOTE'
    );
    if (!alreadySent) {
      NotificationService.send({
        userId: match.technicianId,
        title: 'New Nearby Repair Request',
        message: `New repair request: ${request.deviceBrand} ${request.deviceModel} (${(request.issues || []).join(', ')}) in ${request.customerLocation.area || request.customerLocation.city || 'Nearby'} (~${match.distanceKm} km). Submit a quote!`,
        type: 'QUOTE',
        repairId: requestId,
      });
    }
  }

  AuditService.log({
    actorId: customerId,
    actorRole: 'customer',
    action: 'TECHNICIAN_DISCOVERY_TRIGGERED',
    resourceType: 'REPAIR_REQUEST',
    resourceId: requestId,
    details: { matchedCount: matched.length },
  });

  db.save();
  const requestQuotes = db.repairQuotes.filter((q) => q.requestId === requestId && q.status !== 'WITHDRAWN');
  const matchedWithQuotes = matched.map((m) => {
    const q = requestQuotes.find((rq) => rq.technicianId === m.technicianId);
    return {
      ...m,
      technician: sanitizeTechnicianForPublic(m.technician),
      quote: q ? sanitizeQuoteForCustomer(q, customerId) : null,
    };
  });
  return res.json({ request, matchedTechnicians: matchedWithQuotes });
});

apiRouter.post('/repairs/requests/:id/cancel', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const result = RepairWorkflowService.cancelRequest({
    requestId: req.params.id,
    actorId: req.user!.id,
    actorRole: 'customer',
    reason: req.body?.reason ? sanitizeString(req.body.reason, 500) : undefined,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/repairs/requests', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const {
    customerLocation,
    deviceBrand,
    deviceModel,
    deviceModelId,
    deviceType,
    catalogMatch,
    issues,
    otherDescription,
    description,
    photos,
    attachments,
    voiceNoteUrl,
    voiceNoteDurationSeconds,
  } = req.body;

  if (!customerLocation) {
    return res.status(400).json({ error: 'Customer location is required.' });
  }

  geocodeCustomerLocation(customerLocation);

  const isProduction = process.env.NODE_ENV === 'production';
  const locationValidation = validateCustomerLocationPayload(customerLocation, isProduction);
  if (!locationValidation.valid || !locationValidation.sanitizedLocation) {
    return res.status(400).json({ error: locationValidation.error || 'Invalid location data.' });
  }

  if (!isNonEmptyString(deviceBrand) || !isNonEmptyString(deviceModel)) {
    return res.status(400).json({ error: 'Device brand and model are required.' });
  }

  if (!Array.isArray(issues) || issues.length === 0) {
    return res.status(400).json({ error: 'At least one diagnosed issue is required.' });
  }

  const user = db.users.find((u) => u.id === req.user!.id);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Idempotency check: prevent duplicate requests within 2 minutes
  const recentDuplicate = db.repairRequests.find(r => 
    r.customerId === user!.id &&
    r.deviceBrand === deviceBrand &&
    r.deviceModel === deviceModel &&
    r.description === description &&
    (new Date(now).getTime() - new Date(r.createdAt).getTime()) < 2 * 60 * 1000
  );

  if (recentDuplicate) {
    return res.status(200).json(recentDuplicate);
  }

  const validatedLocation = locationValidation.sanitizedLocation;

  const safePhotos = Array.isArray(photos)
    ? photos.filter((p) => typeof p === 'string').slice(0, 3)
    : [];

  // PHASE 3 RULE: Submitting a repair request results strictly in REQUESTED state without automatic matching or technician notifications
  const request: RepairRequest = {
    id: requestId,
    customerId: req.user!.id,
    customerName: user?.name || 'Customer',
    customerPhone: user?.phone || '',
    customerLocation: validatedLocation,
    deviceBrand: sanitizeString(deviceBrand, 80),
    deviceModel: sanitizeString(deviceModel, 80),
    deviceModelId: deviceModelId ? sanitizeString(deviceModelId, 80) : undefined,
    deviceType: (deviceType === 'TABLET' ? 'TABLET' : 'PHONE'),
    catalogMatch: catalogMatch !== undefined ? Boolean(catalogMatch) : true,
    issues: issues.map((i) => sanitizeString(i, 80)),
    description: sanitizeString(description, 2000),
    otherDescription: otherDescription ? sanitizeString(otherDescription, 500) : undefined,
    photos: safePhotos,
    attachments: Array.isArray(attachments) ? attachments.slice(0, 4) : [],
    voiceNoteUrl: voiceNoteUrl ? sanitizeString(voiceNoteUrl, 1000) : undefined,
    voiceNoteDurationSeconds: voiceNoteDurationSeconds ? Number(voiceNoteDurationSeconds) : undefined,
    status: 'REQUESTED' as RepairLifecycleStatus,
    quotesCount: 0,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  db.repairRequests.unshift(request);

  const draftIdx = db.drafts.findIndex((d) => d.customerId === req.user!.id);
  if (draftIdx !== -1) {
    db.drafts.splice(draftIdx, 1);
  }

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'customer',
    action: 'REPAIR_REQUEST_CREATED',
    resourceType: 'REPAIR_REQUEST',
    resourceId: requestId,
    details: { deviceBrand: request.deviceBrand, deviceModel: request.deviceModel, issuesCount: issues.length },
  });

  db.save();
  return res.status(201).json(request);
});

apiRouter.get('/repairs/requests', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    // Customers only see their own requests with full location data
    const requests = db.repairRequests.filter((r) => r.customerId === req.user!.id);
    return res.json(paginate(req, res, requests));
  } else if (req.user!.role === 'technician') {
    // Technicians only see ELIGIBLE requests (matching service radius + supported brand)
    let tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
    if (!tech) {
      const user = db.users.find((u) => u.id === req.user!.id);
      if (user) {
        tech = AuthService.ensureTechnicianProfile(user);
      }
    }
    if (!tech) return res.json([]);

    const visibleRequests: any[] = [];

    for (const r of db.repairRequests) {
      const hasQuoted = db.repairQuotes.some((q) => q.requestId === r.id && q.technicianId === req.user!.id);
      const isAssigned = r.selectedTechnicianId === req.user!.id;
      const isOpen =
        r.status === 'REQUESTED' ||
        r.status === 'QUOTING' ||
        r.status === 'SUBMITTED' ||
        r.status === 'MATCHING';

      let isEligible = false;
      let distanceKm: number | undefined;

      if (isOpen) {
        const eligibility = TechnicianMatchingService.isTechnicianEligible(tech, r);
        isEligible = eligibility.eligible;
        distanceKm = eligibility.distanceKm;
      }

      // Technician can view request if open & eligible, or if already quoted/assigned
      if (isEligible || hasQuoted || isAssigned) {
        if (
          !distanceKm &&
          r.customerLocation &&
          typeof r.customerLocation.lat === 'number' &&
          typeof r.customerLocation.lng === 'number' &&
          tech.shopLocation &&
          typeof tech.shopLocation.lat === 'number' &&
          typeof tech.shopLocation.lng === 'number'
        ) {
          distanceKm = calculateDistanceKm(
            r.customerLocation.lat,
            r.customerLocation.lng,
            tech.shopLocation.lat,
            tech.shopLocation.lng
          );
        }

        // Apply Location & Quote Privacy Sanitization
        const sanitized = sanitizeRepairRequestForTechnician(
          r,
          req.user!.id,
          db.repairQuotes,
          distanceKm
        );
        visibleRequests.push(sanitized);
      }
    }

    return res.json(paginate(req, res, visibleRequests));
  }

  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.get('/repairs/requests/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const request = db.repairRequests.find((r) => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }

  if (req.user!.role === 'customer') {
    // Customer must own the request
    if (request.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Repair request not found.' });
    }

    const quotes = db.repairQuotes.filter((q) => q.requestId === request.id).map((q) => sanitizeQuoteForCustomer(q, req.user!.id));
    const matchedTechnicians = TechnicianMatchingService.matchTechnicians({
      customerLocation: request.customerLocation,
      deviceBrand: request.deviceBrand,
      deviceModel: request.deviceModel,
      issues: request.issues,
    }).map((m) => ({ ...m, technician: sanitizeTechnicianForPublic(m.technician) }));
    return res.json({ request, quotes, matchedTechnicians });
  } else if (req.user!.role === 'technician') {
    let tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
    if (!tech) {
      const user = db.users.find((u) => u.id === req.user!.id);
      if (user) {
        tech = AuthService.ensureTechnicianProfile(user);
      }
    }
    if (!tech) {
      return res.status(404).json({ error: 'Repair request not found.' });
    }

    const hasQuoted = db.repairQuotes.some((q) => q.requestId === request.id && q.technicianId === req.user!.id);
    const isAssigned = request.selectedTechnicianId === req.user!.id;
    const isOpen = request.status === 'REQUESTED' || request.status === 'QUOTING';

    const eligibility = TechnicianMatchingService.isTechnicianEligible(tech, request);
    if (!isOpen && !hasQuoted && !isAssigned) {
      return res.status(404).json({ error: 'Repair request not found.' });
    }

    if (isOpen && !eligibility.eligible && !hasQuoted && !isAssigned) {
      return res.status(404).json({ error: 'Repair request not found.' });
    }

    const sanitizedReq = sanitizeRepairRequestForTechnician(
      request,
      req.user!.id,
      db.repairQuotes,
      eligibility.distanceKm
    );

    return res.json({ request: sanitizedReq, quotes: sanitizedReq.quotes });
  }

  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.patch('/repairs/requests/:id/location', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const request = db.repairRequests.find((r) => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }

  if (request.customerId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const { customerLocation } = req.body;
  if (!customerLocation) {
    return res.status(400).json({ error: 'Location is required.' });
  }

  geocodeCustomerLocation(customerLocation);

  const isProduction = process.env.NODE_ENV === 'production';
  const locationValidation = validateCustomerLocationPayload(customerLocation, isProduction);
  if (!locationValidation.valid || !locationValidation.sanitizedLocation) {
    return res.status(400).json({ error: locationValidation.error || 'Invalid location data.' });
  }

  // Authoritative location saved, preserving real GPS coordinates
  request.customerLocation = locationValidation.sanitizedLocation;
  request.updatedAt = new Date().toISOString();

  // Re-match technicians
  const matchedTechnicians = TechnicianMatchingService.matchTechnicians({
    customerLocation: request.customerLocation,
    deviceBrand: request.deviceBrand,
    deviceModel: request.deviceModel,
    issues: request.issues,
  });

  db.save();
  return res.json({ success: true, request, matchedTechnicians });
});

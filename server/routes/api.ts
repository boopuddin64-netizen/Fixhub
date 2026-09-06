import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { AuthService } from '../services/authService';
import { TechnicianMatchingService } from '../services/technicianMatchingService';
import { PaymentService } from '../services/paymentService';
import { RepairWorkflowService } from '../services/repairWorkflowService';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { calculateDistanceKm } from '../services/technicianMatchingService';
import {
  UserRole,
  RepairLifecycleStatus,
  RepairRequest,
  ConditionReport,
  PartsQuality,
  CustomerDevice,
} from '../../src/types/index';
import {
  isNonEmptyString,
  sanitizeString,
  validateNumber,
  isValidCoordinates,
  sanitizeCustomerLocationForTechnician,
  sanitizeRepairRequestForTechnician,
} from '../utils/validation';

export const apiRouter = Router();

// Authentication Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    isBorrowedDevice?: boolean;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] role(s).`,
      });
    }
    next();
  };
}

/* -------------------------------------------------------------
 * 1. AUTHENTICATION & SESSIONS
 * ----------------------------------------------------------- */
apiRouter.post('/auth/register-customer', (req: Request, res: Response) => {
  const { name, phone, email, password, address, landmark, city, state, isBorrowedDevice } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(phone) || !isNonEmptyString(email)) {
    return res.status(400).json({ error: 'Name, phone, and email are required.' });
  }

  const result = AuthService.registerCustomer({
    name: sanitizeString(name, 100),
    phone: sanitizeString(phone, 30),
    email: sanitizeString(email, 120),
    password: password ? String(password) : undefined,
    address: address ? sanitizeString(address, 200) : undefined,
    landmark: landmark ? sanitizeString(landmark, 100) : undefined,
    city: city ? sanitizeString(city, 80) : undefined,
    state: state ? sanitizeString(state, 80) : undefined,
    isBorrowedDevice: !!isBorrowedDevice,
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/auth/register-technician', (req: Request, res: Response) => {
  const { name, phone, email, businessName, password, shopAddress, landmark, area, city, state, supportedBrands } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(phone) || !isNonEmptyString(email) || !isNonEmptyString(businessName) || !isNonEmptyString(shopAddress)) {
    return res.status(400).json({ error: 'Name, phone, email, business name, and shop address are required.' });
  }

  const result = AuthService.registerTechnician({
    name: sanitizeString(name, 100),
    phone: sanitizeString(phone, 30),
    email: sanitizeString(email, 120),
    businessName: sanitizeString(businessName, 120),
    password: password ? String(password) : undefined,
    shopAddress: sanitizeString(shopAddress, 200),
    landmark: landmark ? sanitizeString(landmark, 100) : undefined,
    area: area ? sanitizeString(area, 80) : undefined,
    city: city ? sanitizeString(city, 80) : undefined,
    state: state ? sanitizeString(state, 80) : undefined,
    supportedBrands: Array.isArray(supportedBrands) ? supportedBrands.map((b) => sanitizeString(b, 50)) : undefined,
  });

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { emailOrPhone, password, isBorrowedDevice } = req.body;
  if (!isNonEmptyString(emailOrPhone)) {
    return res.status(400).json({ error: 'Email or phone number is required.' });
  }

  const result = AuthService.login(sanitizeString(emailOrPhone, 120), password ? String(password) : undefined, !!isBorrowedDevice);
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
 * 2. DEVICES & CATALOG (Public Discovery)
 * ----------------------------------------------------------- */
apiRouter.get('/devices/brands', (req: Request, res: Response) => {
  const deviceType = req.query.deviceType as string;
  if (deviceType) {
    const filtered = db.deviceBrands.filter(
      (b) => !b.deviceTypes || b.deviceTypes.includes(deviceType as any)
    );
    return res.json(filtered);
  }
  return res.json(db.deviceBrands);
});

apiRouter.get('/devices/families', (req: Request, res: Response) => {
  const brandId = req.query.brandId as string;
  const deviceType = req.query.deviceType as string;
  let families = db.deviceFamilies || [];
  if (brandId) {
    families = families.filter((f) => f.brandId === brandId);
  }
  if (deviceType) {
    families = families.filter((f) => f.deviceType === deviceType);
  }
  return res.json(families);
});

apiRouter.get('/devices/models', (req: Request, res: Response) => {
  const brandId = req.query.brandId as string;
  const familyId = req.query.familyId as string;
  const deviceType = req.query.deviceType as string;
  const search = req.query.search as string;
  const popular = req.query.popular as string;

  let models = db.deviceModels;
  if (brandId) {
    models = models.filter((m) => m.brandId === brandId);
  }
  if (familyId) {
    models = models.filter((m) => m.familyId === familyId);
  }
  if (deviceType) {
    models = models.filter((m) => !m.deviceType || m.deviceType === deviceType);
  }
  if (popular === 'true') {
    models = models.filter((m) => m.isPopular);
  }
  if (search) {
    const q = search.toLowerCase().trim();
    models = models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.brandName.toLowerCase().includes(q) ||
        (m.familyName && m.familyName.toLowerCase().includes(q))
    );
  }
  return res.json(models);
});

apiRouter.get('/devices/search', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  const deviceType = req.query.deviceType as string;

  if (!query) {
    return res.json({ brands: [], models: [] });
  }

  const matchingBrands = db.deviceBrands.filter((b) =>
    b.name.toLowerCase().includes(query)
  );

  let modelResults = db.deviceModels.filter(
    (m) =>
      m.name.toLowerCase().includes(query) ||
      m.brandName.toLowerCase().includes(query) ||
      (m.familyName && m.familyName.toLowerCase().includes(query))
  );

  if (deviceType) {
    modelResults = modelResults.filter((m) => !m.deviceType || m.deviceType === deviceType);
  }

  return res.json({
    brands: matchingBrands,
    models: modelResults.slice(0, 30),
  });
});

apiRouter.get('/devices/issues', (_req: Request, res: Response) => {
  return res.json(db.repairIssues);
});

/* -------------------------------------------------------------
 * 2b. CUSTOMER SAVED DEVICES (Strict Customer Role & Ownership)
 * ----------------------------------------------------------- */
apiRouter.get('/customer/devices', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.id;
  const devices = (db.customerDevices || []).filter((d) => d.customerId === customerId);
  return res.json(devices);
});

apiRouter.post('/customer/devices', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.id;
  const { brandName, modelName, deviceModelId, deviceType, nickname, color, storage, isPrimary, catalogMatch } = req.body;

  if (!isNonEmptyString(brandName) || !isNonEmptyString(modelName)) {
    return res.status(400).json({ error: 'Brand name and model name are required.' });
  }

  const validDeviceType = (deviceType === 'TABLET' ? 'TABLET' : 'PHONE') as 'PHONE' | 'TABLET';
  const currentCustomerDevices = (db.customerDevices || []).filter((d) => d.customerId === customerId);
  const shouldBePrimary = isPrimary !== undefined ? Boolean(isPrimary) : currentCustomerDevices.length === 0;

  if (shouldBePrimary) {
    (db.customerDevices || []).forEach((d) => {
      if (d.customerId === customerId) {
        d.isPrimary = false;
      }
    });
  }

  const now = new Date().toISOString();
  const newDevice: CustomerDevice = {
    id: `cdev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    customerId,
    deviceModelId: deviceModelId ? sanitizeString(deviceModelId, 80) : undefined,
    brandName: sanitizeString(brandName, 80),
    modelName: sanitizeString(modelName, 100),
    deviceType: validDeviceType,
    nickname: nickname ? sanitizeString(nickname, 60) : undefined,
    color: color ? sanitizeString(color, 40) : undefined,
    storage: storage ? sanitizeString(storage, 30) : undefined,
    isPrimary: shouldBePrimary,
    catalogMatch: catalogMatch !== undefined ? Boolean(catalogMatch) : true,
    createdAt: now,
    updatedAt: now,
  };

  db.customerDevices.push(newDevice);
  db.save();

  AuditService.log({
    actorId: customerId,
    actorRole: 'customer',
    action: 'CUSTOMER_DEVICE_ADDED',
    resourceType: 'CUSTOMER_DEVICE',
    resourceId: newDevice.id,
    details: { brandName: newDevice.brandName, modelName: newDevice.modelName },
  });

  return res.status(201).json(newDevice);
});

apiRouter.put('/customer/devices/:id', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.id;
  const deviceId = req.params.id;
  const device = (db.customerDevices || []).find((d) => d.id === deviceId);

  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  // Enforce customer ownership boundary
  if (device.customerId !== customerId) {
    return res.status(403).json({ error: 'You do not have permission to modify this device.' });
  }

  const { nickname, color, storage, isPrimary } = req.body;

  if (nickname !== undefined) device.nickname = sanitizeString(nickname, 60);
  if (color !== undefined) device.color = sanitizeString(color, 40);
  if (storage !== undefined) device.storage = sanitizeString(storage, 30);

  if (isPrimary === true) {
    (db.customerDevices || []).forEach((d) => {
      if (d.customerId === customerId) {
        d.isPrimary = false;
      }
    });
    device.isPrimary = true;
  } else if (isPrimary === false) {
    device.isPrimary = false;
  }

  device.updatedAt = new Date().toISOString();
  db.save();

  return res.json(device);
});

apiRouter.post('/customer/devices/:id/primary', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.id;
  const deviceId = req.params.id;
  const device = (db.customerDevices || []).find((d) => d.id === deviceId);

  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  if (device.customerId !== customerId) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  (db.customerDevices || []).forEach((d) => {
    if (d.customerId === customerId) {
      d.isPrimary = false;
    }
  });
  device.isPrimary = true;
  device.updatedAt = new Date().toISOString();
  db.save();

  return res.json(device);
});

apiRouter.delete('/customer/devices/:id', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.user!.id;
  const deviceId = req.params.id;
  const index = (db.customerDevices || []).findIndex((d) => d.id === deviceId);

  if (index === -1) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  // Enforce customer ownership boundary
  if (db.customerDevices[index].customerId !== customerId) {
    return res.status(403).json({ error: 'You do not have permission to delete this device.' });
  }

  const [removed] = db.customerDevices.splice(index, 1);
  if (removed.isPrimary) {
    const remaining = db.customerDevices.filter((d) => d.customerId === customerId);
    if (remaining.length > 0) {
      remaining[0].isPrimary = true;
    }
  }

  db.save();

  AuditService.log({
    actorId: customerId,
    actorRole: 'customer',
    action: 'CUSTOMER_DEVICE_DELETED',
    resourceType: 'CUSTOMER_DEVICE',
    resourceId: deviceId,
    details: { deviceId },
  });

  return res.json({ success: true, message: 'Device deleted successfully.' });
});

/* -------------------------------------------------------------
 * 3. TECHNICIAN DISCOVERY & MATCHING (Public / Lead Matching)
 * ----------------------------------------------------------- */
apiRouter.get('/technicians', (_req: Request, res: Response) => {
  return res.json(db.technicianProfiles);
});

apiRouter.get('/technicians/:id', (req: Request, res: Response) => {
  const tech = db.technicianProfiles.find((t) => t.userId === req.params.id);
  if (!tech) {
    return res.status(404).json({ error: 'Technician profile not found.' });
  }
  const parts = db.technicianParts.filter((p) => p.technicianId === tech.userId);
  const reviews = db.reviews.filter((r) => r.technicianId === tech.userId);
  return res.json({ technician: tech, parts, reviews });
});

apiRouter.post('/technicians/match', (req: Request, res: Response) => {
  const { customerLocation, deviceBrand, deviceModel, issues, maxDistanceKm } = req.body;
  if (!customerLocation || !isValidCoordinates(customerLocation.lat, customerLocation.lng)) {
    return res.status(400).json({ error: 'Valid customer location GPS coordinates (lat, lng) are required.' });
  }

  const results = TechnicianMatchingService.matchTechnicians({
    customerLocation: {
      lat: Number(customerLocation.lat),
      lng: Number(customerLocation.lng),
      address: sanitizeString(customerLocation.address, 200) || 'Lagos, Nigeria',
      area: sanitizeString(customerLocation.area, 80),
      city: sanitizeString(customerLocation.city, 80) || 'Lagos',
      state: sanitizeString(customerLocation.state, 80) || 'Lagos State',
    },
    deviceBrand: sanitizeString(deviceBrand, 80) || 'Other',
    deviceModel: sanitizeString(deviceModel, 80),
    issues: Array.isArray(issues) ? issues.map((i) => sanitizeString(i, 80)) : [],
    maxDistanceKm: maxDistanceKm ? Math.min(Math.max(Number(maxDistanceKm), 1), 100) : 30,
  });

  return res.json(results);
});

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
      city: sanitizeString(customerLocation.city, 80) || 'Lagos',
      state: sanitizeString(customerLocation.state, 80) || 'Lagos State',
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

// 4.2 Attachment Upload (Base64 / Data URL)
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

  const attachment = {
    id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: type as 'IMAGE' | 'AUDIO',
    url: fileData,
    mimeType: sanitizeString(mimeType, 100) || (type === 'IMAGE' ? 'image/jpeg' : 'audio/webm'),
    size: Number(size) || Math.round(fileData.length * 0.75),
    createdAt: new Date().toISOString(),
    durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
  };

  return res.status(201).json(attachment);
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
    status: requestedStatus,
  } = req.body;

  if (!customerLocation || !isValidCoordinates(customerLocation.lat, customerLocation.lng)) {
    return res.status(400).json({ error: 'Valid customer location coordinates are required.' });
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

  const validatedLocation = {
    lat: Number(customerLocation.lat),
    lng: Number(customerLocation.lng),
    address: sanitizeString(customerLocation.address, 200) || `${customerLocation.area || 'Lagos'}, ${customerLocation.city || 'Lagos'}`,
    landmark: sanitizeString(customerLocation.landmark, 100),
    area: sanitizeString(customerLocation.area, 80),
    city: sanitizeString(customerLocation.city, 80) || 'Lagos',
    state: sanitizeString(customerLocation.state, 80) || 'Lagos State',
  };

  // Restrict to max 3 photos
  const safePhotos = Array.isArray(photos)
    ? photos.filter((p) => typeof p === 'string').slice(0, 3)
    : [];

  const initialStatus = requestedStatus === 'REQUESTED' ? 'REQUESTED' : 'MATCHING';

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
    status: initialStatus as RepairLifecycleStatus,
    quotesCount: 0,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  db.repairRequests.unshift(request);

  // Clear customer's saved draft upon successful request submission
  const draftIdx = db.drafts.findIndex((d) => d.customerId === req.user!.id);
  if (draftIdx !== -1) {
    db.drafts.splice(draftIdx, 1);
  }

  // Notify matching nearby eligible technicians
  const matched = TechnicianMatchingService.matchTechnicians({
    customerLocation: validatedLocation,
    deviceBrand: request.deviceBrand,
    deviceModel: request.deviceModel,
    issues: request.issues,
    maxDistanceKm: 25,
  });

  for (const match of matched.slice(0, 5)) {
    NotificationService.send({
      userId: match.technicianId,
      title: 'New Nearby Repair Request',
      message: `New repair request: ${request.deviceBrand} ${request.deviceModel} (${request.issues.join(', ')}) in ${validatedLocation.area || validatedLocation.city} (~${match.distanceKm} km). Submit a quote!`,
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
    details: { deviceBrand: request.deviceBrand, deviceModel: request.deviceModel, issuesCount: issues.length },
  });

  db.save();
  return res.status(201).json(request);
});

apiRouter.get('/repairs/requests', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    // Customers only see their own requests with full location data
    const requests = db.repairRequests.filter((r) => r.customerId === req.user!.id);
    return res.json(requests);
  } else if (req.user!.role === 'technician') {
    // Technicians only see ELIGIBLE requests (matching service radius + supported brand)
    const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
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

    return res.json(visibleRequests);
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

    const quotes = db.repairQuotes.filter((q) => q.requestId === request.id);
    return res.json({ request, quotes });
  } else if (req.user!.role === 'technician') {
    const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
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

/* -------------------------------------------------------------
 * 5. TECHNICIAN QUOTES (Strict Validation & Anti-Tampering)
 * ----------------------------------------------------------- */
apiRouter.post('/quotes/submit', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { requestId, partsCost, laborCost, otherCost, estimatedTimeHours, warrantyDays, partsQuality, notes } = req.body;

  if (!isNonEmptyString(requestId)) {
    return res.status(400).json({ error: 'Request ID is required.' });
  }

  const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
  const user = db.users.find((u) => u.id === req.user!.id);
  const request = db.repairRequests.find((r) => r.id === requestId);

  if (!tech || !user) {
    return res.status(404).json({ error: 'Technician profile not found.' });
  }

  if (!request) {
    return res.status(404).json({ error: 'Repair request not found.' });
  }

  // 1. Verify request is open for quotes
  if (request.status !== 'REQUESTED' && request.status !== 'QUOTING') {
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

  // 3. Strict Server-Side Numerical Validation
  const partsVal = validateNumber(partsCost, 'Parts cost', { min: 0, max: 10_000_000 });
  if (partsVal.valid === false) return res.status(400).json({ error: partsVal.error });

  const laborVal = validateNumber(laborCost, 'Labor cost', { min: 0, max: 10_000_000 });
  if (laborVal.valid === false) return res.status(400).json({ error: laborVal.error });

  const otherVal = otherCost !== undefined && otherCost !== null && otherCost !== ''
    ? validateNumber(otherCost, 'Other cost', { min: 0, max: 10_000_000 })
    : { valid: true as const, value: 0 };
  if (otherVal.valid === false) return res.status(400).json({ error: otherVal.error });

  const hoursVal = validateNumber(estimatedTimeHours || 2, 'Estimated time', { min: 1, max: 720, integerOnly: true });
  if (hoursVal.valid === false) return res.status(400).json({ error: hoursVal.error });

  const warrantyVal = validateNumber(warrantyDays || 60, 'Warranty days', { min: 30, max: 365, integerOnly: true });
  if (warrantyVal.valid === false) return res.status(400).json({ error: warrantyVal.error });

  // Server-Authoritative Total Calculation (never trust client total)
  const totalAmount = partsVal.value + laborVal.value + otherVal.value;

  const allowedQualities: PartsQuality[] = [
    'ORIGINAL_OEM',
    'PREMIUM_AFTERMARKET',
    'STANDARD_AFTERMARKET',
    'REFURBISHED',
  ];
  const resolvedQuality: PartsQuality = allowedQualities.includes(partsQuality)
    ? partsQuality
    : 'PREMIUM_AFTERMARKET';

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

  // Check for existing pending quote from this technician
  const existingQuote = db.repairQuotes.find(
    (q) => q.requestId === requestId && q.technicianId === req.user!.id && q.status === 'PENDING'
  );

  const quoteId = existingQuote ? existingQuote.id : `quote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
    distanceKm: Math.round(distanceKm * 10) / 10,
    partsCost: partsVal.value,
    laborCost: laborVal.value,
    otherCost: otherVal.value,
    totalAmount,
    estimatedTimeHours: hoursVal.value,
    warrantyDays: warrantyVal.value,
    partsQuality: resolvedQuality,
    notes: sanitizeString(notes, 1000),
    status: 'PENDING' as const,
    createdAt: existingQuote ? existingQuote.createdAt : now,
  };

  if (existingQuote) {
    Object.assign(existingQuote, quote);
  } else {
    db.repairQuotes.push(quote);
    request.quotesCount = (request.quotesCount || 0) + 1;
  }

  request.status = 'QUOTING';
  request.updatedAt = now;

  NotificationService.send({
    userId: request.customerId,
    title: 'New Quote Received!',
    message: `${tech.businessName} submitted a quote of ₦${totalAmount.toLocaleString()} (${quote.warrantyDays} days warranty) for your ${request.deviceBrand} ${request.deviceModel}.`,
    type: 'QUOTE',
    repairId: request.id,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'technician',
    action: 'QUOTE_SUBMITTED',
    resourceType: 'REPAIR_QUOTE',
    resourceId: quoteId,
    details: { requestId, totalAmount, partsQuality: resolvedQuality },
  });

  db.save();
  return res.status(201).json(quote);
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

/* -------------------------------------------------------------
 * 6. PAYMENTS & ESCROW (Server-Authoritative Amounts & Ownership)
 * ----------------------------------------------------------- */
apiRouter.post('/payments/create-intent', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const { repairJobId, idempotencyKey, paymentMethod } = req.body;
  if (!isNonEmptyString(repairJobId) || !isNonEmptyString(idempotencyKey)) {
    return res.status(400).json({ error: 'Repair Job ID and Idempotency Key are required.' });
  }

  const allowedMethods = ['CARD', 'BANK_TRANSFER', 'USSD'] as const;
  const resolvedMethod = allowedMethods.includes(paymentMethod) ? paymentMethod : 'CARD';

  const result = PaymentService.createPaymentIntent({
    repairJobId,
    customerId: req.user!.id,
    idempotencyKey: sanitizeString(idempotencyKey, 100),
    paymentMethod: resolvedMethod,
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
    paymentId: paymentId ? String(paymentId) : '',
    transactionRef: transactionRef ? String(transactionRef) : '',
    actorId: req.user!.id,
    actorRole: req.user!.role,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

/* -------------------------------------------------------------
 * 7. REPAIR JOBS & WORKFLOW (Strict Object-Level Authorization)
 * ----------------------------------------------------------- */
apiRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role === 'customer') {
    const jobs = db.repairJobs.filter((j) => j.customerId === req.user!.id);
    return res.json(jobs);
  } else if (req.user!.role === 'technician') {
    const jobs = db.repairJobs.filter((j) => j.technicianId === req.user!.id);
    return res.json(jobs);
  }
  return res.status(403).json({ error: 'Forbidden.' });
});

apiRouter.get('/jobs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  // Object-level ownership check
  if (req.user!.role === 'customer' && job.customerId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }
  if (req.user!.role === 'technician' && job.technicianId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
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
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  if (job.technicianId !== req.user!.id) {
    return res.status(404).json({ error: 'Repair job not found.' });
  }

  // Job must currently be in BOOKED status
  if (job.status !== 'BOOKED') {
    return res.status(400).json({ error: `Cannot check in device: Job status is ${job.status}, expected BOOKED.` });
  }

  // Prevent duplicate check-in
  if (job.conditionReport) {
    return res.status(400).json({ error: 'Device has already been checked in.' });
  }

  const rawReport = req.body.report;
  if (!rawReport || typeof rawReport !== 'object') {
    return res.status(400).json({ error: 'Physical condition intake assessment report required.' });
  }

  const allowedFrontBack = ['PERFECT', 'MINOR_SCRATCHES', 'CRACKED', 'SHATTERED'] as const;
  const allowedFrame = ['PRISTINE', 'SCUFFED', 'BENT', 'DENTED'] as const;

  if (!rawReport.frontCondition || !allowedFrontBack.includes(rawReport.frontCondition)) {
    return res.status(400).json({ error: 'Valid front condition is required (PERFECT, MINOR_SCRATCHES, CRACKED, SHATTERED).' });
  }
  if (!rawReport.backCondition || !allowedFrontBack.includes(rawReport.backCondition)) {
    return res.status(400).json({ error: 'Valid back condition is required (PERFECT, MINOR_SCRATCHES, CRACKED, SHATTERED).' });
  }
  if (!rawReport.frameCondition || !allowedFrame.includes(rawReport.frameCondition)) {
    return res.status(400).json({ error: 'Valid frame condition is required (PRISTINE, SCUFFED, BENT, DENTED).' });
  }

  const conditionReport: ConditionReport = {
    timestamp: new Date().toISOString(),
    frontCondition: rawReport.frontCondition,
    backCondition: rawReport.backCondition,
    frameCondition: rawReport.frameCondition,
    screenPowersOn: Boolean(rawReport.screenPowersOn),
    touchResponsive: rawReport.touchResponsive !== undefined ? Boolean(rawReport.touchResponsive) : true,
    cameraWorking: rawReport.cameraWorking !== undefined ? Boolean(rawReport.cameraWorking) : true,
    existingDamageNotes: sanitizeString(rawReport.existingDamageNotes, 1000),
    accessoriesReceived: Array.isArray(rawReport.accessoriesReceived)
      ? rawReport.accessoriesReceived.filter((a): a is string => typeof a === 'string').map((a) => sanitizeString(a, 100))
      : [],
    photos: Array.isArray(rawReport.photos)
      ? rawReport.photos.filter((p): p is string => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:image/') || p.length > 0))
      : [],
    technicianNotes: sanitizeString(rawReport.technicianNotes, 1000),
    confirmedByCustomer: Boolean(rawReport.confirmedByCustomer),
  };

  const result = RepairWorkflowService.checkInDevice({
    jobId: req.params.id,
    technicianId: req.user!.id,
    report: conditionReport,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.patch('/jobs/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { newStatus, note } = req.body;
  const job = db.repairJobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Repair job not found.' });

  // Task 4: Explicit defensive protection against generic DEVICE_RECEIVED updates
  if (newStatus === 'DEVICE_RECEIVED') {
    return res.status(403).json({
      error: 'DEVICE_RECEIVED can only be created through the device check-in workflow.',
    });
  }

  // Ownership verification & role-based allowed transitions
  if (req.user!.role === 'technician') {
    if (job.technicianId !== req.user!.id) {
      return res.status(404).json({ error: 'Repair job not found.' });
    }

    // Task 1: Allowed technician statuses strictly limited to operational transitions
    const allowedTechStatuses: RepairLifecycleStatus[] = [
      'DIAGNOSING',
      'REPAIR_IN_PROGRESS',
      'READY_FOR_PICKUP',
    ];
    if (!allowedTechStatuses.includes(newStatus)) {
      return res.status(403).json({
        error: `Forbidden: Technicians cannot transition status to ${newStatus} via generic status update.`,
      });
    }
  } else if (req.user!.role === 'customer') {
    if (job.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Repair job not found.' });
    }

    // Task 6: Customers can only initiate legitimate customer handoff/pickup updates
    const allowedCustomerStatuses: RepairLifecycleStatus[] = [
      'DEVICE_DROPPED_OFF',
      'PICKED_UP',
      'CANCELLED',
    ];
    if (!allowedCustomerStatuses.includes(newStatus)) {
      return res.status(403).json({
        error: `Forbidden: Customers cannot transition status to ${newStatus} directly.`,
      });
    }
  } else {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  // State machine transition verification
  const valid = RepairWorkflowService.isValidTransition(job.status, newStatus);
  if (!valid) {
    return res.status(400).json({
      error: `Invalid state transition from ${job.status} to ${newStatus}.`,
    });
  }

  const previousStatus = job.status;
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
    note: sanitizeString(note, 500) || `Status updated to ${newStatus}`,
  });

  AuditService.log({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: `STATUS_CHANGED_${newStatus}`,
    resourceType: 'REPAIR_JOB',
    resourceId: job.id,
    details: { previousStatus, newStatus, note: sanitizeString(note, 200) },
  });

  db.save();
  return res.json({ success: true, job });
});

apiRouter.post('/jobs/:id/add-part', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { partName, deviceModel, quality, priceNaira, warrantyDays, supplier, beforePhotoUrl, afterPhotoUrl } = req.body;

  if (!isNonEmptyString(partName)) {
    return res.status(400).json({ error: 'Part name is required.' });
  }

  const priceVal = validateNumber(priceNaira, 'Part price', { min: 0, max: 10_000_000 });
  if (priceVal.valid === false) return res.status(400).json({ error: priceVal.error });

  const warrantyVal = validateNumber(warrantyDays || 60, 'Warranty days', { min: 0, max: 365, integerOnly: true });
  if (warrantyVal.valid === false) return res.status(400).json({ error: warrantyVal.error });

  const allowedQualities: PartsQuality[] = [
    'ORIGINAL_OEM',
    'PREMIUM_AFTERMARKET',
    'STANDARD_AFTERMARKET',
    'REFURBISHED',
  ];
  const resolvedQuality: PartsQuality = allowedQualities.includes(quality) ? quality : 'PREMIUM_AFTERMARKET';

  const result = RepairWorkflowService.addPartUsed({
    jobId: req.params.id,
    technicianId: req.user!.id,
    part: {
      partName: sanitizeString(partName, 120),
      deviceModel: sanitizeString(deviceModel, 80) || 'Standard',
      quality: resolvedQuality,
      priceNaira: priceVal.value,
      warrantyDays: warrantyVal.value,
      supplier: supplier ? sanitizeString(supplier, 120) : undefined,
      beforePhotoUrl: beforePhotoUrl ? sanitizeString(beforePhotoUrl, 500) : undefined,
      afterPhotoUrl: afterPhotoUrl ? sanitizeString(afterPhotoUrl, 500) : undefined,
    },
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(201).json(result);
});

apiRouter.post('/jobs/:id/additional-diagnosis', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { title, description, additionalCostNaira, photoEvidence } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ error: 'Title is required for additional diagnosis.' });
  }

  const costVal = validateNumber(additionalCostNaira, 'Additional cost', { min: 0, max: 10_000_000 });
  if (costVal.valid === false) return res.status(400).json({ error: costVal.error });

  const result = RepairWorkflowService.submitAdditionalDiagnosis({
    jobId: req.params.id,
    technicianId: req.user!.id,
    title: sanitizeString(title, 150),
    description: sanitizeString(description, 1500),
    additionalCostNaira: costVal.value,
    photoEvidence: Array.isArray(photoEvidence) ? photoEvidence.filter((p) => typeof p === 'string') : [],
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
  return res.json(reviews);
});

/* -------------------------------------------------------------
 * 9. PARTS CATALOG & TECHNICIAN SETTINGS (Strict Identity Enforcement)
 * ----------------------------------------------------------- */
apiRouter.get('/parts/technician/:id', (req: Request, res: Response) => {
  const parts = db.technicianParts.filter((p) => p.technicianId === req.params.id);
  return res.json(parts);
});

apiRouter.post('/parts', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { name, partName, deviceBrand, deviceModel, quality, priceNaira, inStockCount, stockQuantity, warrantyDays, photoUrl } = req.body;
  const resolvedName = name || partName;

  if (!isNonEmptyString(resolvedName)) {
    return res.status(400).json({ error: 'Part name is required.' });
  }

  const priceVal = validateNumber(priceNaira, 'Part price', { min: 0, max: 10_000_000 });
  if (priceVal.valid === false) return res.status(400).json({ error: priceVal.error });

  const rawStock = inStockCount !== undefined ? inStockCount : (stockQuantity !== undefined ? stockQuantity : 5);
  const stockVal = validateNumber(rawStock, 'Stock count', { min: 0, max: 10_000, integerOnly: true });
  if (stockVal.valid === false) return res.status(400).json({ error: stockVal.error });

  const warrantyVal = validateNumber(warrantyDays !== undefined ? warrantyDays : 60, 'Warranty days', { min: 0, max: 365, integerOnly: true });
  if (warrantyVal.valid === false) return res.status(400).json({ error: warrantyVal.error });

  const allowedQualities: PartsQuality[] = [
    'ORIGINAL_OEM',
    'PREMIUM_AFTERMARKET',
    'STANDARD_AFTERMARKET',
    'REFURBISHED',
  ];
  const resolvedQuality: PartsQuality = allowedQualities.includes(quality) ? quality : 'PREMIUM_AFTERMARKET';

  const part = {
    id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    technicianId: req.user!.id, // Enforce authenticated technician identity
    name: sanitizeString(resolvedName, 120),
    partName: sanitizeString(resolvedName, 120),
    deviceBrand: sanitizeString(deviceBrand, 80) || 'All',
    deviceModel: sanitizeString(deviceModel, 80) || 'All Models',
    quality: resolvedQuality,
    priceNaira: priceVal.value,
    inStockCount: stockVal.value,
    stockQuantity: stockVal.value,
    warrantyDays: warrantyVal.value,
    photoUrl: photoUrl ? sanitizeString(photoUrl, 500) : undefined,
  };

  db.technicianParts.push(part);
  db.save();
  return res.status(201).json(part);
});

apiRouter.put('/technicians/profile', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const tech = db.technicianProfiles.find((t) => t.userId === req.user!.id);
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!tech || !user) return res.status(404).json({ error: 'Technician profile not found.' });

  const { businessName, bio, shopLocation, businessHours, phone, supportedBrands, supportedCategories, serviceRadiusKm, bankDetails } = req.body;

  if (isNonEmptyString(businessName)) {
    tech.businessName = sanitizeString(businessName, 120);
    user.name = tech.businessName;
  }

  if (bio !== undefined) tech.bio = sanitizeString(bio, 1000);
  if (businessHours) tech.businessHours = sanitizeString(businessHours, 100);

  if (isNonEmptyString(phone)) {
    tech.phone = sanitizeString(phone, 30);
    user.phone = tech.phone;
  }

  if (Array.isArray(supportedBrands)) {
    tech.supportedBrands = supportedBrands.map((b) => sanitizeString(b, 50));
  }

  if (Array.isArray(supportedCategories)) {
    tech.supportedCategories = supportedCategories.map((c) => sanitizeString(c, 50));
  }

  if (serviceRadiusKm !== undefined) {
    const radiusVal = validateNumber(serviceRadiusKm, 'Service radius', { min: 1, max: 100 });
    if (radiusVal.valid) {
      tech.serviceRadiusKm = radiusVal.value;
    }
  }

  if (shopLocation && typeof shopLocation === 'object') {
    tech.shopLocation = {
      ...tech.shopLocation,
      address: shopLocation.address ? sanitizeString(shopLocation.address, 200) : tech.shopLocation.address,
      landmark: shopLocation.landmark ? sanitizeString(shopLocation.landmark, 100) : tech.shopLocation.landmark,
      area: shopLocation.area ? sanitizeString(shopLocation.area, 80) : tech.shopLocation.area,
      city: shopLocation.city ? sanitizeString(shopLocation.city, 80) : tech.shopLocation.city,
      state: shopLocation.state ? sanitizeString(shopLocation.state, 80) : tech.shopLocation.state,
      lat: isValidCoordinates(shopLocation.lat, shopLocation.lng) ? Number(shopLocation.lat) : tech.shopLocation.lat,
      lng: isValidCoordinates(shopLocation.lat, shopLocation.lng) ? Number(shopLocation.lng) : tech.shopLocation.lng,
    };
  }

  if (bankDetails && typeof bankDetails === 'object') {
    tech.bankDetails = {
      bankName: sanitizeString(bankDetails.bankName, 80) || 'Access Bank',
      accountNumber: sanitizeString(bankDetails.accountNumber, 30),
      accountName: sanitizeString(bankDetails.accountName, 120) || tech.businessName || user.name,
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
 * 10. NOTIFICATIONS & MESSAGING (Strict Recipient Authorization)
 * ----------------------------------------------------------- */
apiRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  // Always filter strictly by authenticated user's ID, ignoring query parameters
  const notifs = db.notifications.filter((n) => n.userId === req.user!.id);
  return res.json(notifs);
});

apiRouter.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (!notif || notif.userId !== req.user!.id) {
    return res.status(404).json({ error: 'Notification not found.' });
  }

  NotificationService.markAsRead(req.params.id, req.user!.id);
  return res.json({ success: true });
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
  return res.json(messages);
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
    return res.json(warranties);
  } else if (req.user!.role === 'technician') {
    const warranties = db.warranties.filter((w) => w.technicianId === req.user!.id);
    return res.json(warranties);
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

/* -------------------------------------------------------------
 * 12. DEMO / TEST RESET
 * ----------------------------------------------------------- */
apiRouter.post('/dev/reset-seed', (_req: Request, res: Response) => {
  db.resetToSeed();
  return res.json({ success: true, message: 'Database reset to initial test seed data.' });
});

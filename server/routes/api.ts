import fs from "fs";
import path from "path";
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
  validateCustomerLocationPayload,
} from '../utils/validation';
import { POPULAR_NIGERIAN_LOCATIONS } from '../../src/data/nigerianLocations';

export function geocodeCustomerLocation(customerLocation: any) {
  if (!customerLocation) return;
  
  const isProd = process.env.NODE_ENV === "production";

  // If coordinates are already valid, we are good!
  if (isValidCoordinates(customerLocation.lat, customerLocation.lng)) {
    const isFallbackCoords = 
      (Number(customerLocation.lat) === 4.8156 && Number(customerLocation.lng) === 7.0498) ||
      (Number(customerLocation.lat) === 4.8156 && Number(customerLocation.lng) === 7.0128 && customerLocation.source === 'DEVELOPMENT_FALLBACK');
    
    if (isFallbackCoords) {
      if (isProd) {
        // In production, we cannot accept DEVELOPMENT_FALLBACK coordinates!
        customerLocation.lat = 0;
        customerLocation.lng = 0;
        customerLocation.source = 'MANUAL';
      } else {
        customerLocation.source = 'DEVELOPMENT_FALLBACK';
        return;
      }
    } else {
      if (!customerLocation.source) {
        customerLocation.source = 'GPS';
      }
      return;
    }
  }

  if (customerLocation.source === 'DEVELOPMENT_FALLBACK') {
    if (isProd) {
      customerLocation.source = 'MANUAL';
    } else {
      customerLocation.lat = 4.8156;
      customerLocation.lng = 7.0498;
      return;
    }
  }

  // Coords are missing or invalid. Try geocoding based on specific area or landmark text!
  const textToSearch = [
    customerLocation.landmark,
    customerLocation.address,
    customerLocation.area,
  ].filter(Boolean).join(' ').toLowerCase();

  // Look for a specific match in POPULAR_NIGERIAN_LOCATIONS (do not match generic "Port Harcourt")
  let bestMatch = null;
  if (textToSearch.trim().length > 0) {
    for (const loc of POPULAR_NIGERIAN_LOCATIONS) {
      const areaPrimary = loc.name.toLowerCase().split('/')[0].trim();
      if (
        (loc.landmark && textToSearch.includes(loc.landmark.toLowerCase())) ||
        (loc.name && textToSearch.includes(loc.name.toLowerCase())) ||
        (areaPrimary.length > 3 && textToSearch.includes(areaPrimary))
      ) {
        bestMatch = loc;
        break;
      }
    }
  }

  if (bestMatch) {
    customerLocation.lat = bestMatch.lat;
    customerLocation.lng = bestMatch.lng;
    customerLocation.source = 'GEOCODED';
    if (!customerLocation.city) customerLocation.city = bestMatch.city;
    if (!customerLocation.state) customerLocation.state = bestMatch.state;
  } else {
    // Geocoding failed: do not fabricate coordinates!
    customerLocation.lat = 0;
    customerLocation.lng = 0;
    customerLocation.source = 'MANUAL';
  }
}

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
  if (!customerLocation) {
    return res.status(400).json({ error: 'Customer location is required.' });
  }

  geocodeCustomerLocation(customerLocation);

  const results = TechnicianMatchingService.matchTechnicians({
    customerLocation: {
      lat: Number(customerLocation.lat),
      lng: Number(customerLocation.lng),
      address: sanitizeString(customerLocation.address, 200) || `${customerLocation.area || ''}${customerLocation.city ? `, ${customerLocation.city}` : ''}`,
      area: sanitizeString(customerLocation.area, 80),
      city: sanitizeString(customerLocation.city, 80) || customerLocation.area || '',
      state: sanitizeString(customerLocation.state, 80) || '',
      source: customerLocation.source,
      accuracyMeters: customerLocation.accuracyMeters,
      timestamp: customerLocation.timestamp,
    },
    deviceBrand: sanitizeString(deviceBrand, 80) || 'Other',
    deviceModel: sanitizeString(deviceModel, 80),
    issues: Array.isArray(issues) ? issues.map((i) => sanitizeString(i, 80)) : [],
    maxDistanceKm: maxDistanceKm ? Math.min(Math.max(Number(maxDistanceKm), 1), 100) : 30,
  });

  return res.json(results);
});

/* -------------------------------------------------------------
 * 3.1 GOOGLE MAPS PLATFORM GEOCODING PROXY
 * ----------------------------------------------------------- */
apiRouter.get('/maps/geocode/reverse', async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(apiKey)}&region=ng`;
      const response = await fetch(gUrl);
      const data = (await response.json()) as any;

      if (data && data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        const top = data.results[0];
        let street = '';
        let neighborhood = '';
        let city = '';
        let state = '';
        let country = 'Nigeria';

        if (Array.isArray(top.address_components)) {
          for (const comp of top.address_components) {
            const types = comp.types || [];
            if (types.includes('route') || types.includes('street_address')) {
              street = comp.long_name;
            } else if (types.includes('sublocality') || types.includes('neighborhood')) {
              neighborhood = comp.long_name;
            } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
              city = comp.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = comp.long_name;
            } else if (types.includes('country')) {
              country = comp.long_name;
            }
          }
        }

        return res.json({
          resolved: true,
          location: {
            address: top.formatted_address,
            street: street || undefined,
            landmark: neighborhood || undefined,
            area: neighborhood || city || undefined,
            city: city || undefined,
            state: state || undefined,
            country: country || 'Nigeria',
          },
          source: 'GOOGLE_MAPS',
        });
      }
    } catch (err) {
      console.warn('Google Maps Geocoding API proxy error:', err);
    }
  }

  // Do not substitute with nearest catalog hub - coordinates must remain authentic
  return res.json({ resolved: false });
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
      else if (lowerMime.includes('svg')) attachExt = 'svg';
      else attachExt = 'jpg';
    } else if (type === 'AUDIO') {
      if (lowerMime.includes('mp4') || lowerMime.includes('m4a') || lowerMime.includes('aac')) attachExt = 'm4a';
      else if (lowerMime.includes('ogg') || lowerMime.includes('opus')) attachExt = 'ogg';
      else if (lowerMime.includes('wav')) attachExt = 'wav';
      else if (lowerMime.includes('3gp')) attachExt = '3gp';
      else attachExt = 'webm';
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
    const ownsRequest = db.repairRequests.some(
      (r) => r.customerId === userId && (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename)))
    );
    const ownsDraft = db.drafts.some(
      (d) => d.customerId === userId && (d.photos?.some((p) => p.includes(safeFilename)) || d.attachments?.some((a) => a.url?.includes(safeFilename)))
    );
    authorized = ownsRequest || ownsDraft;
  } else if (userRole === 'technician') {
    const isAssigned = db.repairJobs.some((j) => j.technicianId === userId && db.repairRequests.some((r) => r.id === j.requestId && (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename)))));
    const hasQuoted = db.repairQuotes.some((q) => q.technicianId === userId && db.repairRequests.some((r) => r.id === q.requestId && (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename)))));
    const isEligibleOpen = db.repairRequests.some((r) => (r.photos?.some((p) => p.includes(safeFilename)) || r.attachments?.some((a) => a.url?.includes(safeFilename))) && TechnicianMatchingService.isTechnicianEligible(db.technicianProfiles.find(t => t.userId === userId)!, r).eligible);
    authorized = isAssigned || hasQuoted || isEligibleOpen;
  } else if (userRole === 'admin') {
    authorized = true;
  }

  if (!authorized) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to access this attachment.' });
  }

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

  const maxDistanceKm = req.body?.maxDistanceKm ? Number(req.body.maxDistanceKm) : 25;
  const matched = TechnicianMatchingService.matchTechnicians({
    customerLocation: request.customerLocation,
    deviceBrand: request.deviceBrand,
    deviceModel: request.deviceModel,
    issues: request.issues,
    maxDistanceKm: Math.min(Math.max(maxDistanceKm, 1), 100),
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
  return res.json({ request, matchedTechnicians: matched });
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
    const matchedTechnicians = TechnicianMatchingService.matchTechnicians({
      customerLocation: request.customerLocation,
      deviceBrand: request.deviceBrand,
      deviceModel: request.deviceModel,
      issues: request.issues,
    });
    return res.json({ request, quotes, matchedTechnicians });
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

/* -------------------------------------------------------------
 * 5. TECHNICIAN QUOTES (Strict Validation & Anti-Tampering)
 * ----------------------------------------------------------- */
apiRouter.post('/quotes/submit', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const {
    requestId,
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

  // 3. Strict Server-Side Numerical Validation
  const partsVal = validateNumber(partsCost, 'Parts cost', { min: 0, max: 10_000_000 });
  if (partsVal.valid === false) return res.status(400).json({ error: partsVal.error });

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

  const warrantyVal = validateNumber(warrantyDays || 60, 'Warranty days', { min: 14, max: 365, integerOnly: true });
  if (warrantyVal.valid === false) return res.status(400).json({ error: warrantyVal.error });

  // Server-Authoritative Total Calculation (never trust client total)
  const totalAmount = partsVal.value + laborVal.value + diagnosticVal.value + otherVal.value;
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

  if (!partsQuality || !allowedQualities.includes(partsQuality)) {
    return res.status(400).json({ error: 'Invalid parts quality specified.' });
  }
  const resolvedQuality: PartsQuality = partsQuality;

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
    partsCost: partsVal.value,
    laborCost: laborVal.value,
    diagnosticCost: diagnosticVal.value,
    otherCost: otherVal.value,
    totalAmount,
    estimatedTimeHours: hoursVal.value,
    warrantyDays: warrantyVal.value,
    partsQuality: resolvedQuality,
    notes: sanitizeString(notes || '', 1000),
    limitationsOrConditions: sanitizeString(limitationsOrConditions || '', 1000),
    expiresAt,
    status: 'SUBMITTED' as const,
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
    details: { requestId, totalAmount, partsQuality: resolvedQuality },
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

    return res.json(quotes);
  } else if (req.user!.role === 'technician') {
    // Technician only sees their own quote for this request
    const quotes = db.repairQuotes.filter((q) => q.requestId === request.id && q.technicianId === req.user!.id);
    return res.json(quotes);
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
    return res.json(quotesWithRequests);
  } else if (req.user!.role === 'customer') {
    const customerRequests = db.repairRequests.filter((r) => r.customerId === req.user!.id);
    const requestIds = new Set(customerRequests.map((r) => r.id));
    const quotes = db.repairQuotes.filter((q) => requestIds.has(q.requestId));
    return res.json(quotes);
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

/* -------------------------------------------------------------
 * 6. PAYMENTS & ESCROW (Server-Authoritative Amounts & Ownership)
 * ----------------------------------------------------------- */
apiRouter.post('/payments/initialize', requireAuth, requireRole(['customer']), async (req: AuthenticatedRequest, res: Response) => {
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

apiRouter.post('/payments/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

apiRouter.post('/payments/webhook', async (req: Request, res: Response) => {
  const signatureHeader = req.headers['x-paystack-signature'] as string | undefined;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  const result = await PaymentService.processWebhook({
    rawBody,
    signatureHeader,
    eventPayload: req.body,
  });

  return res.status(result.statusCode).json(result);
});

apiRouter.post('/payments/refund', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { paymentId, amountNaira, reason } = req.body;
  if (!paymentId || !reason) {
    return res.status(400).json({ error: 'Payment ID and Refund Reason are required.' });
  }

  const result = PaymentService.recordRefund({
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

apiRouter.get('/technicians/earnings', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const technicianId = req.user!.id;
  const earnings = db.technicianEarnings.filter((e) => e.technicianId === technicianId);
  const payouts = db.payouts.filter((p) => p.technicianId === technicianId);

  const heldNaira = earnings
    .filter((e) => e.status === 'HELD')
    .reduce((sum, e) => sum + e.netEarningsNaira, 0);

  const eligibleGrossNaira = earnings
    .filter((e) => e.status === 'ELIGIBLE_FOR_PAYOUT')
    .reduce((sum, e) => sum + e.netEarningsNaira, 0);

  const lockedInPayoutsNaira = payouts
    .filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING')
    .reduce((sum, p) => sum + p.amountNaira, 0);

  const availablePayoutNaira = Math.max(0, eligibleGrossNaira - lockedInPayoutsNaira);

  const completedPayoutsNaira = payouts
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amountNaira, 0);

  return res.json({
    earnings,
    payouts,
    summary: {
      heldEarningsNaira: heldNaira,
      availablePayoutNaira,
      lockedInProcessingNaira: lockedInPayoutsNaira,
      totalCompletedPayoutsNaira: completedPayoutsNaira,
      commissionRatePercent: PaymentService.COMMISSION_RATE * 100,
    },
  });
});

apiRouter.post('/technicians/payouts/request', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { amountNaira, destinationAccount } = req.body;
  if (!amountNaira || Number(amountNaira) <= 0) {
    return res.status(400).json({ error: 'Valid payout amount in Naira is required.' });
  }

  const result = PaymentService.requestPayout({
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

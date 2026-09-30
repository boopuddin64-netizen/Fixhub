import { Request, Response } from 'express';
import { db } from '../../db';
import { AuditService } from '../../services/auditService';
import { paginate } from '../../utils/pagination';
import { CustomerDevice } from '../../../src/types/index';
import { isNonEmptyString, sanitizeString } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole } from './shared';

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
  return res.json(paginate(req, res, devices));
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

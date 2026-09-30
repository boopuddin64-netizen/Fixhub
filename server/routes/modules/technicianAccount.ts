import { Request, Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { InventoryService } from '../../services/inventoryService';
import { PaystackClient } from '../../services/paystackClient';
import { IdentityVerificationService } from '../../services/identityVerificationService';
import { getBankCodeByName, getBankNameByCode } from '../../data/nigerianBanks';
import { BankOtpService, BANK_OTP_TTL_MS } from '../../services/bankOtpService';
import { sendSms } from '../../services/smsService';
import { paginate } from '../../utils/pagination';
import { authRateLimiter } from '../../middleware/rateLimiters';
import { isNonEmptyString, sanitizeString, validateNumber, isValidCoordinates } from '../../utils/validation';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole, sanitizeTechnicianForOwner } from './shared';

/* -------------------------------------------------------------
 * 9. PARTS CATALOG & TECHNICIAN INVENTORY (Authoritative & Traceable)
 * ----------------------------------------------------------- */
apiRouter.get('/inventory', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { search, brand, category, status, deviceModel } = req.query;
  const items = InventoryService.getInventoryByTechnician(req.user!.id, {
    search: typeof search === 'string' ? search : undefined,
    brand: typeof brand === 'string' ? brand : undefined,
    category: typeof category === 'string' ? category : undefined,
    status: typeof status === 'string' ? status : undefined,
    deviceModel: typeof deviceModel === 'string' ? deviceModel : undefined,
  });
  return res.json(paginate(req, res, items));
});

apiRouter.post('/inventory', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const result = InventoryService.createInventoryItem(req.user!.id, req.body);
  if (result.success === false) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(201).json(result.item);
});

apiRouter.get('/inventory/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const item = InventoryService.getInventoryItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Inventory item not found.' });
  }
  return res.json(item);
});

apiRouter.patch('/inventory/:id', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const result = InventoryService.updateInventoryItem(req.params.id, req.user!.id, req.body);
  if (result.success === false) {
    return res.status(400).json({ error: result.error });
  }
  return res.json(result.item);
});

apiRouter.put('/inventory/:id', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const result = InventoryService.updateInventoryItem(req.params.id, req.user!.id, req.body);
  if (result.success === false) {
    return res.status(400).json({ error: result.error });
  }
  return res.json(result.item);
});

apiRouter.get('/inventory/:id/price-history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const item = InventoryService.getInventoryItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Inventory item not found.' });
  }
  return res.json({
    itemId: item.id,
    partName: item.partName,
    currentPrice: item.unitPriceNaira,
    currentVersion: item.priceVersion,
    priceHistory: item.priceHistory || [],
  });
});

apiRouter.get('/parts/technician/:id', (req: Request, res: Response) => {
  const parts = InventoryService.getInventoryByTechnician(req.params.id);
  return res.json(paginate(req, res, parts));
});

apiRouter.post('/parts', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const result = InventoryService.createInventoryItem(req.user!.id, req.body);
  if (result.success === false) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(201).json(result.item);
});

apiRouter.get('/banks', async (req: Request, res: Response) => {
  try {
    const banks = await PaystackClient.listBanks();
    return res.json(banks);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve banks list' });
  }
});

apiRouter.get('/banks/resolve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const accountNumber = String(req.query.accountNumber || '').trim();
  const bankCode = String(req.query.bankCode || '').trim();

  if (!accountNumber || accountNumber.length !== 10) {
    return res.status(400).json({ success: false, error: 'Account number must be exactly 10 digits.' });
  }
  if (!bankCode) {
    return res.status(400).json({ success: false, error: 'Bank code is required.' });
  }

  try {
    const result = await PaystackClient.resolveAccountNumber(accountNumber, bankCode);
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.message || 'Could not resolve account name. Check parameters or try again.',
      });
    }
    return res.json({
      success: true,
      accountName: result.accountName,
      accountNumber,
      bankCode,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error resolving bank account details.' });
  }
});

apiRouter.put('/technicians/profile', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
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
    // Enforcement rule: Government ID verification must come first before bank account setup
    if (!tech.verificationStatus?.identityVerified) {
      return res.status(403).json({
        error: "Government ID verification (Driver's License, Voter's Card, or NIN) must be completed before setting up a payout bank account.",
        requiresIdentityVerification: true,
      });
    }

    const hadExistingBank = !!(tech.bankDetails && tech.bankDetails.accountNumber);

    // If bank details were already set up, require valid security verification
    if (hadExistingBank) {
      const isVerified = BankOtpService.isUnlocked(req.user!.id);
      if (!isVerified) {
        return res.status(403).json({
          error: 'Security verification required: Modifying an existing payout bank account requires identity verification for fraud prevention.',
          requiresVerification: true,
        });
      }
    }

    const rawBankName = sanitizeString(bankDetails.bankName, 80) || 'Access Bank';
    const providedCode = bankDetails.bankCode ? sanitizeString(bankDetails.bankCode, 20) : undefined;
    const resolvedCode = providedCode || getBankCodeByName(rawBankName) || '044';
    const resolvedName = getBankNameByCode(resolvedCode) || rawBankName;
    const providedAccountName = sanitizeString(bankDetails.accountName, 120) || tech.businessName || user.name;

    // Cross-check resolved bank account name against verified Government ID name
    const idVerifiedName = (tech.verificationStatus as any)?.idDetails?.verifiedName;
    if (idVerifiedName && providedAccountName) {
      const isMatch = IdentityVerificationService.isPersonalNameMatch(idVerifiedName, providedAccountName);
      if (!isMatch) {
        return res.status(400).json({
          error: `Settlement bank account name ('${providedAccountName}') does not match your verified Government ID holder name ('${idVerifiedName}'). The payout bank account must belong to the verified technician.`,
        });
      }
    }

    tech.bankDetails = {
      bankName: resolvedName,
      bankCode: resolvedCode,
      accountNumber: sanitizeString(bankDetails.accountNumber, 30),
      accountName: providedAccountName,
      verified: true,
    };
    tech.verificationStatus.payoutVerified = true;
    // Clear the one-time verification
    BankOtpService.clear(req.user!.id);
    delete (tech as any).bankChangeVerification; // legacy field, never populated any more
  }

  db.save();
  return res.json({ success: true, profile: sanitizeTechnicianForOwner(tech), user });
});

// Request security verification code to modify existing payout bank account
apiRouter.post('/technicians/bank/request-change-otp', authRateLimiter, requireAuth, requireRole(['technician']), async (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const issued = BankOtpService.issue(user.id);
  if (!issued.ok) {
    return res.status(429).json({ error: `Please wait ${issued.retryAfterSeconds}s before requesting another code.` });
  }

  const destination = user.email || user.phone || 'registered technician account';
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    // Deliver out-of-band; the code is NEVER returned in the HTTP response in production.
    const sms = user.phone
      ? await sendSms(user.phone, `Your Fixhub security code is ${issued.code}. It expires in ${BANK_OTP_TTL_MS / 60000} minutes. Never share it.`)
      : { success: false, error: 'No phone number on file.' };
    if (!sms.success) {
      BankOtpService.clear(user.id);
      return res.status(502).json({ error: 'We could not deliver your verification code. Please try again shortly.' });
    }
    return res.json({ success: true, message: 'A 6-digit security verification code has been sent to your registered phone number.' });
  }

  // Non-production only: surface the code so local development/testing works without an SMS provider.
  return res.json({
    success: true,
    message: `A 6-digit security verification code has been generated for ${destination}.`,
    devCode: issued.code,
  });
});

// Verify security code to unlock payout bank modification
apiRouter.post('/technicians/bank/verify-change-otp', authRateLimiter, requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const result = BankOtpService.verify(user.id, req.body?.otp);
  if (!result.ok) {
    switch (result.reason) {
      case 'NO_REQUEST':
        return res.status(400).json({ error: 'No active bank verification request found. Please request a new code.' });
      case 'EXPIRED':
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      case 'LOCKED':
        return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new verification code.' });
      default:
        return res.status(400).json({ error: `Incorrect 6-digit verification code. ${result.attemptsLeft} attempt(s) left.` });
    }
  }

  return res.json({
    success: true,
    message: 'Identity verified. Bank account modification is now unlocked.',
  });
});

// Automated Government ID Verification (Driver's License, Voter's Card, NIN)
apiRouter.post('/technicians/verify/government-id', requireAuth, requireRole(['technician']), async (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tech = AuthService.ensureTechnicianProfile(user);
  const { idType, idNumber, dob } = req.body;

  if (!idType || !['DRIVERS_LICENSE', 'VOTERS_CARD', 'NIN'].includes(idType)) {
    return res.status(400).json({ error: "Invalid ID type. Must be 'DRIVERS_LICENSE', 'VOTERS_CARD', or 'NIN'." });
  }

  if (!idNumber || typeof idNumber !== 'string') {
    return res.status(400).json({ error: 'Document ID number is required.' });
  }

  try {
    const result = await IdentityVerificationService.verifyGovernmentId(user, tech, {
      idType,
      idNumber,
      dob,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Mark Government ID as verified
    tech.verificationStatus.identityVerified = true;
    (tech.verificationStatus as any).idDetails = {
      idType: result.idType,
      idNumberMasked: result.idNumberMasked,
      verifiedName: result.verifiedName,
      verifiedAt: new Date().toISOString(),
    };

    // Update overall verified badge if location and business are also confirmed
    (tech as any).isVerified = Boolean(
      tech.verificationStatus.identityVerified &&
      tech.verificationStatus.businessVerified &&
      tech.verificationStatus.locationConfirmed
    );

    db.save();

    return res.json({
      success: true,
      message: result.message,
      verifiedName: result.verifiedName,
      idNumberMasked: result.idNumberMasked,
      profile: sanitizeTechnicianForOwner(tech),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error processing government ID verification.' });
  }
});

// Automated CAC Business Registration Verification (RC / BN Number)
apiRouter.post('/technicians/verify/cac', requireAuth, requireRole(['technician']), async (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tech = AuthService.ensureTechnicianProfile(user);
  const { cacNumber, companyType } = req.body;

  if (!cacNumber || typeof cacNumber !== 'string') {
    return res.status(400).json({ error: 'CAC RC or BN registration number is required.' });
  }

  try {
    const result = await IdentityVerificationService.verifyCac(user, tech, {
      cacNumber,
      companyType,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Mark CAC Business as verified
    tech.verificationStatus.businessVerified = true;
    (tech.verificationStatus as any).cacDetails = {
      rcNumber: result.rcNumber,
      companyName: result.companyName,
      classification: result.classification,
      verifiedAt: new Date().toISOString(),
    };

    // Update overall verified badge
    (tech as any).isVerified = Boolean(
      tech.verificationStatus.identityVerified &&
      tech.verificationStatus.businessVerified &&
      tech.verificationStatus.locationConfirmed
    );

    db.save();

    return res.json({
      success: true,
      message: result.message,
      companyName: result.companyName,
      rcNumber: result.rcNumber,
      classification: result.classification,
      profile: sanitizeTechnicianForOwner(tech),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error processing CAC verification.' });
  }
});

apiRouter.post('/technicians/availability', requireAuth, requireRole(['technician']), (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!status || !['AVAILABLE', 'BUSY', 'OFFLINE'].includes(status)) {
    return res.status(400).json({ error: 'Status must be AVAILABLE, BUSY, or OFFLINE.' });
  }

  let user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    user = {
      id: req.user!.id,
      email: req.user!.email || `tech_${req.user!.id}@fixhub.local`,
      name: 'Technician',
      phone: '',
      role: 'technician',
      createdAt: new Date().toISOString(),
      emailVerified: true,
      phoneVerified: false,
    } as any;
    db.users.push(user);
  }
  const tech = AuthService.ensureTechnicianProfile(user);

  tech.availability = status;
  db.save();
  return res.json({ success: true, availability: status });
});

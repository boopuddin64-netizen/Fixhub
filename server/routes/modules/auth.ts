import { Request, Response } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { AuditService } from '../../services/auditService';
import { authRateLimiter, codeAttemptRateLimiter, codeSendRateLimiter } from '../../middleware/rateLimiters';
import { UserRole } from '../../../src/types/index';
import { isNonEmptyString, sanitizeString } from '../../utils/validation';
import { isValidNgPhone, PHONE_FORMAT_HINT } from '../../../src/utils/format';
import { apiRouter, AuthenticatedRequest, requireAuth, requireRole, requirePasswordConfirmation } from './shared';

/* -------------------------------------------------------------
 * 1. AUTHENTICATION & SESSIONS
 * ----------------------------------------------------------- */
apiRouter.post('/auth/register-customer', authRateLimiter, (req: Request, res: Response) => {
  const { name, phone, email, password, address, landmark, city, state, isBorrowedDevice } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(phone) || !isNonEmptyString(email)) {
    return res.status(400).json({ error: 'Name, phone, and email are required.' });
  }
  if (!isValidNgPhone(phone)) {
    return res.status(400).json({ error: `Enter a valid Nigerian mobile number. ${PHONE_FORMAT_HINT}`, code: 'INVALID_PHONE', field: 'phone' });
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

apiRouter.post('/auth/register-technician', authRateLimiter, (req: Request, res: Response) => {
  const { name, phone, email, businessName, password, shopAddress, landmark, area, city, state, supportedBrands } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(phone) || !isNonEmptyString(email) || !isNonEmptyString(businessName) || !isNonEmptyString(shopAddress)) {
    return res.status(400).json({ error: 'Name, phone, email, business name, and shop address are required.' });
  }
  if (!isValidNgPhone(phone)) {
    return res.status(400).json({ error: `Enter a valid Nigerian mobile number. ${PHONE_FORMAT_HINT}`, code: 'INVALID_PHONE', field: 'phone' });
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

apiRouter.post('/auth/login', authRateLimiter, (req: Request, res: Response) => {
  const { emailOrPhone, password, isBorrowedDevice } = req.body;
  if (!isNonEmptyString(emailOrPhone)) {
    return res.status(400).json({ error: 'Email or phone number is required.' });
  }

  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const result = AuthService.login(sanitizeString(emailOrPhone, 120), password, !!isBorrowedDevice);
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


apiRouter.post('/auth/switch-role', authRateLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  if (!role || !['customer', 'technician'].includes(role)) {
    return res.status(400).json({ error: 'Role must be customer or technician.' });
  }
  if (req.user!.role === 'admin') {
    return res.status(403).json({ error: 'Admin accounts cannot switch roles.' });
  }
  if (!requirePasswordConfirmation(req, res)) return;
  let user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    user = {
      id: req.user!.id,
      email: req.user!.email || `user_${req.user!.id}@fixhub.local`,
      name: req.user!.email ? req.user!.email.split('@')[0] : 'Fixhub User',
      phone: '',
      role,
      createdAt: new Date().toISOString(),
      emailVerified: true,
      phoneVerified: false,
    } as any;
    db.users.push(user);
  }
  user.role = role;
  if (role === 'technician') {
    AuthService.ensureTechnicianProfile(user);
  } else {
    AuthService.ensureCustomerProfile(user);
  }
  db.save();

  const session = AuthService.getUserSession(user.id);
  return res.json(session);
});

apiRouter.post('/auth/social-login', authRateLimiter, async (req: Request, res: Response) => {
  const { provider, token, role } = req.body;
  if (!provider || provider !== 'google') {
    return res.status(400).json({ error: 'Valid provider (google) is required.' });
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Valid provider token is required.' });
  }
  const assignedRole: UserRole = role === 'technician' ? 'technician' : 'customer';

  const result = await AuthService.socialLogin({
    provider: 'google',
    token,
    role: assignedRole,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    AuthService.revokeToken(token);
  }
  return res.json({ success: true, message: 'Successfully logged out and revoked authentication session.' });
});

apiRouter.post('/auth/forgot-password', authRateLimiter, codeSendRateLimiter, async (req: Request, res: Response) => {
  const { emailOrPhone } = req.body;
  if (!isNonEmptyString(emailOrPhone)) {
    return res.status(400).json({ error: 'Email or phone number is required.' });
  }

  const result = await AuthService.requestPasswordReset(sanitizeString(emailOrPhone, 120));
  return res.json({ success: result.success, message: result.message });
});

apiRouter.post('/auth/reset-password', authRateLimiter, codeAttemptRateLimiter, (req: Request, res: Response) => {
  const { code, newPassword } = req.body;
  if (!isNonEmptyString(code) || !isNonEmptyString(newPassword)) {
    return res.status(400).json({ error: 'Reset code and new password are required.' });
  }

  const result = AuthService.resetPasswordWithCode(sanitizeString(code, 20), String(newPassword));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Password reset successfully. You can now sign in with your new password.' });
});

apiRouter.post('/auth/change-password', requireAuth, authRateLimiter, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!isNonEmptyString(newPassword)) {
    return res.status(400).json({ error: 'New password is required.' });
  }

  const result = AuthService.changePassword(
    req.user!.id,
    currentPassword ? String(currentPassword) : undefined,
    String(newPassword)
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  AuditService.log({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: 'PASSWORD_CHANGED',
    resourceType: 'USER',
    resourceId: req.user!.id,
    details: {},
    ipAddress: req.ip,
  });

  // Other sessions were signed out by the password change; return a fresh token for this one.
  return res.json({ success: true, message: result.message || 'Password changed successfully.', token: result.token });
});

/**
 * Set a FIRST password on an account that has none (social / Google sign-in only). Authenticated; refused with 409
 * when the account already has a password (changing one needs the current password: POST /auth/change-password).
 * Same password rules as registration; bcrypt cost 12; audit-logged (never with the password); other sessions are
 * signed out and the response carries a fresh token that the client must store.
 */
apiRouter.post('/auth/set-password', authRateLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const newPassword = req.body?.newPassword ?? req.body?.password;
  if (typeof newPassword !== 'string' || newPassword.length === 0) {
    return res.status(400).json({ error: 'New password is required.', code: 'WEAK_PASSWORD' });
  }

  const result = AuthService.setPassword(req.user!.id, newPassword.slice(0, 200));
  if ('error' in result) {
    return res.status(result.status).json({ error: result.error, code: result.code });
  }

  AuditService.log({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: 'PASSWORD_SET',
    resourceType: 'USER',
    resourceId: req.user!.id,
    details: { method: 'set-password', hadPassword: false },
    ipAddress: req.ip,
  });

  // The old token is now invalid (session version bumped): hand back a fresh one.
  const session = AuthService.getUserSession(req.user!.id);
  return res.json({ success: true, message: result.message, token: result.token, user: session?.user });
});

apiRouter.post('/auth/verify-email/request', codeSendRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const result = await AuthService.requestEmailVerification(req.user!.id);
  return res.json({ success: result.success, message: result.message });
});

apiRouter.post('/auth/verify-email/confirm', codeAttemptRateLimiter, (req: Request, res: Response) => {
  const { code } = req.body;
  if (!isNonEmptyString(code)) {
    return res.status(400).json({ error: 'Verification code is required.' });
  }

  const result = AuthService.confirmEmailVerification(sanitizeString(code, 20));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: 'Email address verified successfully.' });
});

apiRouter.post('/auth/verify-phone/request', authRateLimiter, codeSendRateLimiter, async (req: Request, res: Response) => {
  const { phoneOrUserId, userId } = req.body;
  if (!isNonEmptyString(phoneOrUserId)) {
    return res.status(400).json({ error: 'Phone number or user ID is required.' });
  }

  // The body `userId` is client-supplied and must NOT be trusted as an identity (it let anyone trigger
  // SMS to / confirm codes for another user). Only a verified bearer token identifies the caller.
  void userId;
  let authenticatedUserId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = AuthService.verifyToken(token);
    if (session?.id) {
      authenticatedUserId = session.id;
    }
  }

  const result = await AuthService.requestPhoneVerification(sanitizeString(phoneOrUserId, 120), authenticatedUserId);
  return res.json(result);
});

apiRouter.post('/auth/verify-phone/confirm', authRateLimiter, codeAttemptRateLimiter, (req: Request, res: Response) => {
  const { phoneOrUserId, code, userId } = req.body;
  if (!isNonEmptyString(phoneOrUserId) || !isNonEmptyString(code)) {
    return res.status(400).json({ error: 'Phone/User ID and verification code are required.' });
  }

  // The body `userId` is client-supplied and must NOT be trusted as an identity (it let anyone trigger
  // SMS to / confirm codes for another user). Only a verified bearer token identifies the caller.
  void userId;
  let authenticatedUserId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = AuthService.verifyToken(token);
    if (session?.id) {
      authenticatedUserId = session.id;
    }
  }

  const result = AuthService.confirmPhoneVerification(sanitizeString(phoneOrUserId, 120), sanitizeString(code, 20), authenticatedUserId);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

apiRouter.get('/account/export-data', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const user = db.users.find((u) => u.id === userId);
  const customerProfile = db.customerProfiles.find((c) => c.userId === userId);
  const technicianProfile = db.technicianProfiles.find((t) => t.userId === userId);
  const repairRequests = db.repairRequests.filter((r) => r.customerId === userId);
  const repairJobs = db.repairJobs.filter((j) => j.customerId === userId || j.technicianId === userId);
  const quotes = db.repairQuotes.filter((q) => q.technicianId === userId);
  const payments = db.payments.filter((p) => p.customerId === userId);
  const reviews = db.reviews.filter((r) => r.customerId === userId || r.technicianId === userId);

  const exportPayload = {
    exportMeta: {
      platform: 'Fixhub Nigeria',
      ndprCompliant: true,
      exportedAt: new Date().toISOString(),
      userId,
    },
    user: user ? AuthService.toPublicUser(user) : undefined,
    customerProfile,
    technicianProfile,
    repairRequests,
    repairJobs,
    quotes,
    payments,
    reviews,
  };

  return res.json(exportPayload);
});

apiRouter.delete('/account/me', authRateLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  if (req.user!.role === 'admin') {
    return res.status(403).json({ error: 'Admin accounts cannot be deleted here. Ask another admin to suspend the account.' });
  }
  if (!requirePasswordConfirmation(req, res)) return;

  // 1. Remove user
  db.users = db.users.filter((u) => u.id !== userId);
  // 2. Remove profiles
  db.customerProfiles = db.customerProfiles.filter((c) => c.userId !== userId);
  db.technicianProfiles = db.technicianProfiles.filter((t) => t.userId !== userId);

  // Revoke current token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    AuthService.revokeToken(authHeader.substring(7));
  }

  db.save();

  return res.json({
    success: true,
    message: 'Your account and personal data have been permanently deleted in compliance with NDPR right to erasure.',
  });
});

apiRouter.put('/customer/profile', requireAuth, requireRole(['customer']), (req: AuthenticatedRequest, res: Response) => {
  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'Customer user record not found.' });
  }

  const cust = AuthService.ensureCustomerProfile(user);

  const { name, phone, email, address, landmark, city, state, notificationPreferences } = req.body;

  if (isNonEmptyString(name)) {
    user.name = sanitizeString(name, 100);
  }
  if (isNonEmptyString(phone)) {
    user.phone = sanitizeString(phone, 30);
  }
  if (isNonEmptyString(email)) {
    user.email = sanitizeString(email, 120);
  }

  if (cust) {
    if (!cust.defaultLocation) {
      cust.defaultLocation = {
        lat: 4.8156,
        lng: 7.0498,
        address: '',
        landmark: '',
        city: 'Port Harcourt',
        state: 'Rivers State',
      };
    }
    if (address !== undefined) cust.defaultLocation.address = sanitizeString(address, 200);
    if (landmark !== undefined) cust.defaultLocation.landmark = sanitizeString(landmark, 100);
    if (city !== undefined) cust.defaultLocation.city = sanitizeString(city, 80);
    if (state !== undefined) cust.defaultLocation.state = sanitizeString(state, 80);

    if (notificationPreferences && typeof notificationPreferences === 'object') {
      cust.notificationPreferences = {
        repairUpdates: notificationPreferences.repairUpdates !== undefined ? Boolean(notificationPreferences.repairUpdates) : true,
        paymentUpdates: notificationPreferences.paymentUpdates !== undefined ? Boolean(notificationPreferences.paymentUpdates) : true,
        promotional: notificationPreferences.promotional !== undefined ? Boolean(notificationPreferences.promotional) : false,
      };
    }
  }

  db.save();

  AuditService.log({
    actorId: req.user!.id,
    actorRole: 'customer',
    action: 'CUSTOMER_PROFILE_UPDATED',
    resourceType: 'USER',
    resourceId: user.id,
    details: { name: user.name, email: user.email },
  });

  const session = AuthService.getUserSession(req.user!.id);
  return res.json({ success: true, user: AuthService.toPublicUser(user), profile: cust, session });
});

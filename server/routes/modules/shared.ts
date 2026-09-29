/**
 * Shared building blocks for the API route modules: the router itself (with the durability barrier), auth
 * middleware, re-authentication and response sanitizers. Route modules register their handlers on `apiRouter`;
 * server/routes/api.ts imports them in a fixed order (route order matters in Express).
 */
import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { AuthService } from '../../services/authService';
import { makeAsyncSafe } from '../../utils/asyncRouter';
import { UserRole, TechnicianProfile } from '../../../src/types/index';
import { isValidCoordinates } from '../../utils/validation';
import { POPULAR_NIGERIAN_LOCATIONS } from '../../../src/data/nigerianLocations';

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

export const apiRouter = makeAsyncSafe(Router());

/**
 * Durability barrier: for every state-changing request (anything but GET/HEAD/OPTIONS) the response is held
 * back until pending changes are committed to PostgreSQL. An acknowledged write therefore survives a crash
 * or restart. If the write cannot be committed the client gets a 500 instead of a false success.
 * (No-op until db.init() has enabled persistence, e.g. in unit tests.)
 */
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || !db.isPersistent) return next();
  const originalEnd = res.end.bind(res) as (...args: any[]) => Response;
  (res as any).end = (...args: any[]) => {
    (res as any).end = originalEnd;
    db.flush().then(
      () => originalEnd(...args),
      (err) => {
        console.error('[persistence] response withheld, write not durable:', err?.message || err);
        if (res.headersSent) return originalEnd(...args);
        res.statusCode = 500;
        res.removeHeader('Content-Length');
        res.removeHeader('ETag');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return originalEnd(JSON.stringify({ error: 'Internal Server Error' }));
      }
    );
    return res;
  };
  next();
});

// Authentication Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    isBorrowedDevice?: boolean;
  };
}

/** The only route that may authenticate with ?token= (media elements cannot set headers). */
const QUERY_TOKEN_ROUTE = /^\/repairs\/attachments\/[A-Za-z0-9._-]+$/;

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (
    req.method === 'GET' &&
    typeof req.query?.token === 'string' &&
    QUERY_TOKEN_ROUTE.test(req.path)
  ) {
    // Query-string tokens leak via logs/Referer/history, so they are accepted ONLY for streaming
    // attachment media (<audio>/<img> elements cannot send an Authorization header).
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required.' });
  }

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

/**
 * Re-authentication gate for sensitive account actions. Wrong/missing password -> 403 (NOT 401: the web client
 * treats 401 as "session expired" and drops the token). Accounts without a password must set one first.
 */
export function requirePasswordConfirmation(req: AuthenticatedRequest, res: Response): boolean {
  const result = AuthService.confirmPassword(req.user!.id, req.body?.password ?? req.body?.currentPassword);
  if (!('reason' in result)) return true;
  if (result.reason === 'NO_PASSWORD') {
    res.status(403).json({
      error: 'Set a password on your account first (Profile > Security), then repeat this action.',
      code: 'PASSWORD_NOT_SET',
    });
  } else {
    res.status(403).json({ error: 'Password confirmation failed. Enter your current password.', code: 'PASSWORD_CONFIRMATION_FAILED' });
  }
  return false;
}

/**
 * Public view of a technician: no bank details, trust score, OTP state and NO phone number.
 * The phone is only revealed to a customer who has an active job with that technician
 * (see customerHasActiveJobWith / GET /jobs/:id).
 */
export function sanitizeTechnicianForPublic(tech: TechnicianProfile): Omit<TechnicianProfile, 'bankDetails' | 'trustScore' | 'phone'> {
  const { bankDetails, trustScore, phone: _phone, bankChangeVerification: _bcv, ...publicTech } = tech as any;
  return publicTech;
}

/** Job states in which the customer may see / call the technician (paid, not yet closed). */
const PHONE_VISIBLE_JOB_STATUSES = new Set<string>([
  'PAYMENT_CONFIRMED', 'BOOKED', 'DEVICE_DROPPED_OFF', 'DEVICE_RECEIVED', 'DIAGNOSING',
  'REPAIR_IN_PROGRESS', 'ADDITIONAL_DIAGNOSIS', 'READY_FOR_PICKUP', 'PICKED_UP',
]);

export function customerHasActiveJobWith(customerId: string, technicianId: string): boolean {
  return db.repairJobs.some(
    (j) => j.customerId === customerId && j.technicianId === technicianId && PHONE_VISIBLE_JOB_STATUSES.has(j.status)
  );
}

/** Customer-facing quote: the technician's phone is blanked unless the customer has an active job with them. */
export function sanitizeQuoteForCustomer<T extends { technicianId: string; technicianPhone?: string }>(quote: T, customerId: string): T {
  if (customerHasActiveJobWith(customerId, quote.technicianId)) return quote;
  return { ...quote, technicianPhone: '' };
}

/** Owner-facing view: full profile (incl. own bank details) but never any OTP/verification secrets. */
export function sanitizeTechnicianForOwner(tech: TechnicianProfile): TechnicianProfile {
  const { bankChangeVerification: _bcv, ...rest } = tech as any;
  return rest as TechnicianProfile;
}

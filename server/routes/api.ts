/**
 * API entry point. The routes live in server/routes/modules/*.ts (one file per area); this file only
 * assembles them. IMPORT ORDER = ROUTE REGISTRATION ORDER (e.g. literal /technicians/earnings must be
 * registered before /technicians/:id), so do not reorder the side-effect imports below.
 *
 * Everything that used to be exported from this file is re-exported for backward compatibility.
 */
import './modules/health';
import './modules/auth';
import './modules/devices';
import './modules/technicians';
import './modules/repairs';
import './modules/quotes';
import './modules/payments';
import './modules/jobs';
import './modules/reviews';
import './modules/technicianAccount';
import './modules/messaging';
import './modules/adminPortal';
import './modules/admin';

export { apiRouter, geocodeCustomerLocation, requireAuth, requireRole, sanitizeTechnicianForPublic, customerHasActiveJobWith, sanitizeQuoteForCustomer, sanitizeTechnicianForOwner, requirePasswordConfirmation } from './modules/shared';
export type { AuthenticatedRequest } from './modules/shared';

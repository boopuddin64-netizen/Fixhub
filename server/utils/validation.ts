import { LocationCoordinates, RepairRequest, RepairQuote, PartsQuality } from '../../src/types/index';

/**
 * Validates whether a value is a non-empty string.
 */
export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Sanitizes a string by trimming and limiting max length.
 */
export function sanitizeString(val: unknown, maxLength = 255): string {
  if (typeof val !== 'string') return '';
  return val.trim().substring(0, maxLength);
}

export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: string };

/**
 * Validates and sanitizes a numerical value (currency, count, coordinates, etc.).
 */
export function validateNumber(
  val: unknown,
  fieldName: string,
  options?: {
    min?: number;
    max?: number;
    integerOnly?: boolean;
  }
): ValidationResult<number> {
  const num = typeof val === 'number' ? val : Number(val);

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: `${fieldName} must be a valid number.` };
  }

  if (options?.integerOnly && !Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer.` };
  }

  if (options?.min !== undefined && num < options.min) {
    return { valid: false, error: `${fieldName} cannot be less than ${options.min}.` };
  }

  if (options?.max !== undefined && num > options.max) {
    return { valid: false, error: `${fieldName} cannot exceed ${options.max}.` };
  }

  return { valid: true, value: num };
}

/**
 * Validates latitude and longitude.
 */
export function isValidCoordinates(lat: unknown, lng: unknown): boolean { if(lat === null || lat === undefined || lat === "") return false; if(lng === null || lng === undefined || lng === "") return false; 
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (isNaN(latNum) || isNaN(lngNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lngNum < -180 || lngNum > 180) return false;

  return true;
}

/**
 * Privacy sanitizer: Mask exact customer street address and coordinates for technicians
 * until booking/check-in, returning only general area, city, and state.
 */
export function sanitizeCustomerLocationForTechnician(
  loc: LocationCoordinates,
  distanceKm?: number
): LocationCoordinates {
  if (!loc) {
    return {
      address: 'Location Unavailable',
      area: 'General Area',
      city: 'Unknown City',
      state: 'Unknown State',
      lat: 0,
      lng: 0,
    };
  }

  return {
    address: loc.area ? `${loc.area}${loc.city ? `, ${loc.city}` : ''}` : `${loc.city || 'Local Area'}${loc.state ? `, ${loc.state}` : ''}`,
    area: loc.area || loc.city || 'Local Area',
    city: loc.city || loc.area || 'Unknown City',
    state: loc.state || 'Unknown State',
    landmark: undefined,
    lat: 0,
    lng: 0,
  };
}

/**
 * Sanitizes a repair request for technician viewing:
 * 1. Masks customer exact coordinates & street address
 * 2. Only includes quotes submitted by THIS technician (hiding competitor quotes)
 * 3. Keeps customer contact number private during quoting phase
 */
export function sanitizeRepairRequestForTechnician(
  request: RepairRequest,
  techUserId: string,
  quotes: RepairQuote[] = [],
  estimatedDistanceKm?: number
): any {
  const isAssigned = request.selectedTechnicianId === techUserId;
  const techQuotes = quotes.filter((q) => q.technicianId === techUserId && q.requestId === request.id);

  return {
    ...request,
    customerLocation: isAssigned
      ? request.customerLocation
      : sanitizeCustomerLocationForTechnician(request.customerLocation, estimatedDistanceKm),
    customerPhone: isAssigned ? request.customerPhone : undefined,
    quotes: techQuotes,
    quotesCount: request.quotesCount,
    estimatedDistanceKm,
  };
}

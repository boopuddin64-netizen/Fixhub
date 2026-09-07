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

export interface LocationValidationResult {
  valid: boolean;
  error?: string;
  sanitizedLocation?: LocationCoordinates;
}

export function validateCustomerLocationPayload(
  payload: any,
  isProduction: boolean
): LocationValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Location data is required.' };
  }

  const {
    lat,
    lng,
    address,
    landmark,
    area,
    city,
    state,
    country,
    accuracyMeters,
    timestamp,
    capturedAt,
    source,
  } = payload;

  // 1. Source validation
  const validSources = ['GPS', 'GEOCODED', 'MANUAL', 'DEVELOPMENT_FALLBACK'];
  if (source && !validSources.includes(source)) {
    return { valid: false, error: 'Invalid location source specified.' };
  }

  // 2. Production / Development isolation
  if (isProduction) {
    if (source === 'DEVELOPMENT_FALLBACK') {
      return {
        valid: false,
        error: 'Development fallback locations are not allowed in production. Please select or enter a real location.',
      };
    }
    // Hardcoded fallback coordinates check
    if (Number(lat) === 4.8156 && Number(lng) === 7.0498) {
      return {
        valid: false,
        error: 'Development fallback locations are not allowed in production. Please select or enter a real location.',
      };
    }
  }

  // 3. Latitude & Longitude validation
  const hasLat = lat !== undefined && lat !== null && lat !== '';
  const hasLng = lng !== undefined && lng !== null && lng !== '';
  let validCoords = false;
  let parsedLat = 0;
  let parsedLng = 0;

  if (hasLat || hasLng) {
    parsedLat = Number(lat);
    parsedLng = Number(lng);

    if (isNaN(parsedLat) || !isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      return { valid: false, error: 'Latitude must be a valid number between -90 and 90.' };
    }
    if (isNaN(parsedLng) || !isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return { valid: false, error: 'Longitude must be a valid number between -180 and 180.' };
    }

    if (parsedLat !== 0 || parsedLng !== 0) {
      validCoords = true;
    }
  }

  // 4. Accuracy validation
  let parsedAccuracy: number | undefined = undefined;
  if (accuracyMeters !== undefined && accuracyMeters !== null && accuracyMeters !== '') {
    parsedAccuracy = Number(accuracyMeters);
    if (isNaN(parsedAccuracy) || !isFinite(parsedAccuracy) || parsedAccuracy < 0) {
      return { valid: false, error: 'Accuracy must be a non-negative number.' };
    }
  }

  // 5. GPS Source validation
  if (source === 'GPS' && !validCoords) {
    return { valid: false, error: 'Valid device GPS coordinates (latitude and longitude) are required when source is GPS.' };
  }

  // 6. Real Coordinates Requirement (No fabricated coordinates, no un-geocoded text submissions)
  if (!validCoords) {
    return {
      valid: false,
      error: 'Valid location coordinates are required. Please search and select a valid area, or use your current location.',
    };
  }

  const sanitized: LocationCoordinates = {
    lat: parsedLat,
    lng: parsedLng,
    address: sanitizeString(address, 200) || 'Selected Location',
    landmark: landmark ? sanitizeString(landmark, 100) : undefined,
    area: sanitizeString(area, 80) || undefined,
    city: sanitizeString(city, 80) || sanitizeString(area, 80) || 'Port Harcourt',
    state: sanitizeString(state, 80) || 'Rivers State',
    country: sanitizeString(country, 60) || 'Nigeria',
    accuracyMeters: parsedAccuracy,
    timestamp: timestamp ? String(timestamp) : undefined,
    capturedAt: capturedAt ? String(capturedAt) : undefined,
    source: (source as any) || 'GEOCODED',
  };

  return {
    valid: true,
    sanitizedLocation: sanitized,
  };
}

import { POPULAR_NIGERIAN_LOCATIONS, NigerianArea } from '../data/nigerianLocations';

export interface GeocodedAddress {
  address?: string;
  street?: string;
  landmark?: string;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ReverseGeocodeResult {
  resolved: boolean;
  location?: GeocodedAddress;
}

/**
 * Calculates straight line distance in km between two lat/lng coordinates (Haversine formula).
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves GPS coordinates to real geographical address, street, landmark, area, city, state, country.
 * 
 * Layer 1: Query Fixhub's Google Maps geocoding proxy (/api/maps/geocode/reverse).
 * Layer 2: Client/Browser OpenStreetMap Nominatim reverse geocoder.
 * Layer 3: Unresolved Geocode Handler (returns resolved: false, NEVER inventing fake city/state).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return { resolved: false };
  }

  // 1. Layer 1: Query Fixhub's Google Maps geocoding proxy
  if (typeof fetch !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`/api/maps/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.resolved && data.location) {
          return {
            resolved: true,
            location: data.location,
          };
        }
      }
    } catch {
      // Proxy unavailable, offline, or non-200: continue to Layer 2
    }
  }

  // 2. Layer 2: OpenStreetMap Nominatim live reverse geocoding
  if (typeof fetch !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'FixHub-Location-Engine/1.0',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const a = data.address;
          let rawCity = a.city || a.town || a.suburb || a.village || a.county || '';
          let rawState = a.state || '';
          const street = a.road || a.pedestrian || a.suburb || '';
          const landmark = a.neighbourhood || a.suburb || '';
          const area = a.suburb || a.neighbourhood || a.city_district || rawCity;

          // Normalize city name (e.g. 'Port-Harcourt' -> 'Port Harcourt')
          let city = rawCity.replace(/-/g, ' ').trim();
          // Normalize Nigerian state name (e.g. 'Rivers' -> 'Rivers State')
          let state = rawState.trim();
          if (state && !state.toLowerCase().includes('state') && !state.toLowerCase().includes('fct')) {
            state = `${state} State`;
          }

          if (city || state || street || data.display_name) {
            return {
              resolved: true,
              location: {
                address: data.display_name || `${street}, ${city}, ${state}`.trim(),
                street: street || undefined,
                landmark: landmark || undefined,
                area: area || city || undefined,
                city: city || undefined,
                state: state || undefined,
                country: a.country || 'Nigeria',
              },
            };
          }
        }
      }
    } catch {
      // Network/timeout/CORS/offline: fall through to unresolved
    }
  }

  // 3. Layer 3: Unresolved Geocode Handler
  // REAL GPS coordinates remain source of truth! NEVER fabricate or invent city/state if unresolved!
  return {
    resolved: false,
  };
}

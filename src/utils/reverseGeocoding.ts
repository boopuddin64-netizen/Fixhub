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
 * 1. Checks proximity to pre-seeded Rivers State hubs / locations (< 12 km).
 * 2. If available & online, attempts live reverse geocode via OpenStreetMap Nominatim.
 * 3. If geocoding fails, returns resolved: false WITHOUT fabricating or inventing fake cities/states.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // 1. If in browser/client or fetch available, query Fixhub's Google Maps geocoding proxy
  if (typeof fetch !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
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
      // Proxy unavailable or offline: continue to catalog/Nominatim
    }
  }

  // 2. Check known locations in catalog (e.g. Rivers State hubs)
  let nearest: NigerianArea | null = null;
  let minDistanceKm = Infinity;

  for (const loc of POPULAR_NIGERIAN_LOCATIONS) {
    const dist = haversineDistanceKm(lat, lng, loc.lat, loc.lng);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      nearest = loc;
    }
  }

  // If within 12km of a known hub, resolve using the authoritative hub metadata
  if (nearest && minDistanceKm <= 12) {
    return {
      resolved: true,
      location: {
        address: nearest.landmark ? `${nearest.name} (near ${nearest.landmark})` : nearest.name,
        street: nearest.name,
        landmark: nearest.landmark,
        area: nearest.name,
        city: nearest.city,
        state: nearest.state,
        country: 'Nigeria',
      },
    };
  }

  // 2. Attempt live reverse geocode via Nominatim if fetch is available
  if (typeof fetch !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const a = data.address;
          const city = a.city || a.town || a.suburb || a.village || a.county || '';
          const state = a.state || '';
          const street = a.road || a.pedestrian || a.suburb || '';
          const landmark = a.neighbourhood || a.suburb || '';
          const area = a.suburb || a.neighbourhood || a.city_district || city;

          if (city || state) {
            return {
              resolved: true,
              location: {
                address: data.display_name || `${street}, ${city}, ${state}`.trim(),
                street,
                landmark,
                area,
                city,
                state,
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

  // 3. Crucial requirement: NEVER fabricate or invent city/state if unresolved!
  return {
    resolved: false,
  };
}

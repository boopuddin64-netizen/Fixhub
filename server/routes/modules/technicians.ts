import { Request, Response } from 'express';
import { db } from '../../db';
import { TechnicianMatchingService } from '../../services/technicianMatchingService';
import { PaymentService } from '../../services/paymentService';
import { paginate } from '../../utils/pagination';
import { sanitizeString } from '../../utils/validation';
import { geocodeCustomerLocation, apiRouter, AuthenticatedRequest, requireAuth, requireRole, sanitizeTechnicianForPublic } from './shared';

/* -------------------------------------------------------------
 * 3. TECHNICIAN DISCOVERY & MATCHING (Public / Lead Matching)
 * ----------------------------------------------------------- */

apiRouter.get('/technicians', (req: Request, res: Response) => {
  return res.json(paginate(req, res, db.technicianProfiles.map(sanitizeTechnicianForPublic)));
});

// NOTE: literal /technicians/* routes must be registered BEFORE /technicians/:id, otherwise
// Express matches the parameterised route first (e.g. /technicians/earnings).
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

apiRouter.get('/technicians/:id', (req: Request, res: Response) => {
  // Read-only: this public endpoint must never create users or profiles.
  const techId = String(req.params.id);
  const tech = db.technicianProfiles.find((t) => t.userId === techId || (t as any).id === techId);
  if (!tech) {
    return res.status(404).json({ error: 'Technician not found.' });
  }
  const parts = db.technicianParts.filter((p) => p.technicianId === tech.userId);
  const reviews = db.reviews.filter((r) => r.technicianId === tech.userId);
  return res.json({ technician: sanitizeTechnicianForPublic(tech), parts, reviews });
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

  const sanitizedResults = results.map((r) => ({
    ...r,
    technician: sanitizeTechnicianForPublic(r.technician),
  }));

  return res.json(sanitizedResults);
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

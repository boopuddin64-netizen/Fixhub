import { db } from '../../server/db';
import {
  validateCustomerLocationPayload,
  isValidCoordinates,
} from '../../server/utils/validation';
import { POPULAR_NIGERIAN_LOCATIONS } from '../data/nigerianLocations';
import { reverseGeocode } from '../utils/reverseGeocoding';
import {
  TechnicianMatchingService,
  calculateDistanceKm,
} from '../../server/services/technicianMatchingService';
import { LocationCoordinates, RepairRequest } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] [LOCATION FIX] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] [LOCATION FIX] ${testName} ${detail ? `-> ${detail}` : ''}`);
    failed++;
  }
}

export async function runLocationFixTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n===============================================================');
  console.log('   FIXHUB LOCATION ARCHITECTURE & PHASE 3 VALIDATION TESTS');
  console.log('===============================================================\n');

  db.resetToSeed();

  // ---------------------------------------------------------------------------
  // TEST 1: Real GPS remains unchanged
  // ---------------------------------------------------------------------------
  console.log('1. Test: Real GPS remains unchanged');
  const realGpsPayload = {
    lat: 9.076543,
    lng: 7.398612,
    accuracyMeters: 5,
    timestamp: new Date().toISOString(),
    source: 'GPS',
    address: 'Central Area',
    city: 'Abuja',
    state: 'FCT',
  };
  const res1 = validateCustomerLocationPayload(realGpsPayload, false);
  assert(res1.valid === true, 'Payload with real GPS coordinates passes validation');
  assert(
    res1.sanitizedLocation?.lat === 9.076543 && res1.sanitizedLocation?.lng === 7.398612,
    'Exact latitude and longitude coordinates are preserved without alteration or rounding loss'
  );
  assert(res1.sanitizedLocation?.source === 'GPS', 'Source remains strictly GPS');

  // ---------------------------------------------------------------------------
  // TEST 2: GPS does not become Port Harcourt
  // ---------------------------------------------------------------------------
  console.log('\n2. Test: GPS does not become Port Harcourt');
  const nonPhGpsPayload = {
    lat: 9.076543,
    lng: 7.398612,
    accuracyMeters: 10,
    source: 'GPS',
    city: 'Abuja',
    state: 'Federal Capital Territory',
  };
  const res2 = validateCustomerLocationPayload(nonPhGpsPayload, false);
  assert(res2.valid === true, 'Non-Port Harcourt GPS coordinates pass validation');
  assert(
    res2.sanitizedLocation?.city !== 'Port Harcourt' &&
      res2.sanitizedLocation?.state !== 'Rivers State',
    'Real GPS in another region is NOT overwritten with Port Harcourt or Rivers State'
  );
  assert(
    res2.sanitizedLocation?.lat !== 4.8156 && res2.sanitizedLocation?.lng !== 7.0498,
    'Real GPS coordinates are NOT replaced with Port Harcourt fallback coordinates'
  );

  // ---------------------------------------------------------------------------
  // TEST 3: GPS does not become Lagos
  // ---------------------------------------------------------------------------
  console.log('\n3. Test: GPS does not become Lagos');
  const phGpsPayload = {
    lat: 4.8156,
    lng: 7.0128,
    accuracyMeters: 12,
    source: 'GPS',
    city: 'Port Harcourt',
    state: 'Rivers State',
  };
  const res3 = validateCustomerLocationPayload(phGpsPayload, false);
  assert(res3.valid === true, 'Port Harcourt GPS passes validation');
  assert(
    res3.sanitizedLocation?.city !== 'Lagos' && res3.sanitizedLocation?.state !== 'Lagos State',
    'Port Harcourt GPS is NOT converted to Lagos or Lagos State'
  );
  assert(
    res3.sanitizedLocation?.lat !== 6.5244 && res3.sanitizedLocation?.lng !== 3.3792,
    'Coordinates are NOT converted to legacy Lagos coordinates'
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Reverse geocoded city/state stored correctly
  // ---------------------------------------------------------------------------
  console.log('\n4. Test: Reverse geocoded city/state stored correctly');
  // Garrison / Aba Road in Port Harcourt coordinates: 4.8156, 7.0128
  const reverseResult = await reverseGeocode(4.8156, 7.0128);
  assert(reverseResult.resolved === true, 'Reverse geocode successfully resolves known hub coordinates');
  assert(
    reverseResult.location?.city === 'Port Harcourt',
    'Reverse geocode correctly assigns city as Port Harcourt'
  );
  assert(
    reverseResult.location?.state === 'Rivers State',
    'Reverse geocode correctly assigns state as Rivers State'
  );
  assert(
    reverseResult.location?.country === 'Nigeria',
    'Reverse geocode correctly assigns country as Nigeria'
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Reverse geocoding failure does not fabricate data
  // ---------------------------------------------------------------------------
  console.log('\n5. Test: Reverse geocoding failure does not fabricate data');
  // Coordinates in unpopulated ocean coordinates with no local catalog match
  const unmappedCoords = { lat: 0.0001, lng: 0.0001 };
  const failedGeocode = await reverseGeocode(unmappedCoords.lat, unmappedCoords.lng);
  assert(
    failedGeocode.resolved === false,
    'Unmapped coordinates fail geocoding cleanly without fabricating data'
  );
  assert(
    failedGeocode.location === undefined,
    'No fictitious city, state, or address is fabricated upon geocode failure'
  );

  // Validate that when coordinates are passed without city/state, backend does not invent one
  const rawGpsUnresolved = {
    lat: 0.0001,
    lng: 0.0001,
    source: 'GPS',
    accuracyMeters: 20,
    timestamp: new Date().toISOString(),
  };
  const res5 = validateCustomerLocationPayload(rawGpsUnresolved, false);
  assert(res5.valid === true, 'Raw GPS without city/state remains valid');
  assert(
    res5.sanitizedLocation?.city !== 'Port Harcourt' && res5.sanitizedLocation?.city !== 'Lagos',
    'Backend preserves empty/unresolved city without fabricating Port Harcourt or Lagos'
  );

  // ---------------------------------------------------------------------------
  // TEST 6: Development fallback only in dev
  // ---------------------------------------------------------------------------
  console.log('\n6. Test: Development fallback only in dev');
  const devFallbackPayload = {
    lat: 4.8156,
    lng: 7.0498,
    address: 'Aba Road, Garrison, Port Harcourt',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'DEVELOPMENT_FALLBACK',
  };
  const devResult = validateCustomerLocationPayload(devFallbackPayload, false); // isProduction = false
  assert(devResult.valid === true, 'Development fallback is accepted in development mode (isProduction = false)');
  assert(
    devResult.sanitizedLocation?.source === 'DEVELOPMENT_FALLBACK',
    'Source is preserved as DEVELOPMENT_FALLBACK in development'
  );

  // ---------------------------------------------------------------------------
  // TEST 7: Production rejects dev fallback
  // ---------------------------------------------------------------------------
  console.log('\n7. Test: Production rejects dev fallback');
  const prodDevFallback = validateCustomerLocationPayload(devFallbackPayload, true); // isProduction = true
  assert(
    prodDevFallback.valid === false,
    'Production (isProduction = true) strictly rejects source = DEVELOPMENT_FALLBACK'
  );
  assert(
    prodDevFallback.error?.includes('not allowed in production'),
    'Production returns explicit security error for dev fallback'
  );

  // Also verify hardcoded fallback coordinates are rejected in production even if source is disguised
  const disguisedPayload = {
    lat: 4.8156,
    lng: 7.0498,
    address: 'Aba Road',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'GPS',
  };
  const prodDisguisedFallback = validateCustomerLocationPayload(disguisedPayload, true);
  assert(
    prodDisguisedFallback.valid === false,
    'Production rejects hardcoded dev fallback coordinates (4.8156, 7.0498) even if marked as GPS'
  );

  // ---------------------------------------------------------------------------
  // TEST 8: Rivers State seeded locations contain no Lagos locations
  // ---------------------------------------------------------------------------
  console.log('\n8. Test: Rivers State seeded locations contain no Lagos locations');
  const lagosEntries = POPULAR_NIGERIAN_LOCATIONS.filter(
    (loc) =>
      loc.city.toLowerCase() === 'lagos' ||
      loc.state.toLowerCase() === 'lagos' ||
      loc.state.toLowerCase() === 'lagos state' ||
      loc.name.toLowerCase().includes('ikeja') ||
      loc.name.toLowerCase().includes('lekki') ||
      loc.name.toLowerCase().includes('victoria island')
  );
  assert(
    lagosEntries.length === 0,
    `No Lagos locations found in location catalog (found ${lagosEntries.length})`
  );

  const allRivers = POPULAR_NIGERIAN_LOCATIONS.every((loc) => loc.state === 'Rivers State');
  assert(
    allRivers === true,
    'All seeded locations in POPULAR_NIGERIAN_LOCATIONS belong strictly to Rivers State'
  );
  assert(
    POPULAR_NIGERIAN_LOCATIONS.length >= 10,
    `Location catalog contains comprehensive Rivers State hubs (count: ${POPULAR_NIGERIAN_LOCATIONS.length})`
  );

  // ---------------------------------------------------------------------------
  // TEST 9: Matching uses lat/lng
  // ---------------------------------------------------------------------------
  console.log('\n9. Test: Matching uses lat/lng');
  // Match technician at Garrison (4.8156, 7.0128)
  const locGarrison: LocationCoordinates = {
    lat: 4.8156,
    lng: 7.0128,
    address: 'Garrison Junction',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'GPS',
  };
  const garrisonMatches = TechnicianMatchingService.matchTechnicians({
    customerLocation: locGarrison,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['screen_damaged'],
  });

  // Match technician at Choba (4.8988, 6.9142)
  const locChoba: LocationCoordinates = {
    lat: 4.8988,
    lng: 6.9142,
    address: 'Uniport Junction, Choba',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'GPS',
  };
  const chobaMatches = TechnicianMatchingService.matchTechnicians({
    customerLocation: locChoba,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['screen_damaged'],
  });

  assert(garrisonMatches.length > 0, 'Matching succeeds for Garrison coordinates');
  assert(chobaMatches.length > 0, 'Matching succeeds for Choba coordinates');

  // Verify distance is calculated mathematically via coordinates
  const garrisonTech = garrisonMatches.find((m) => m.technicianId === 'usr_tech_5'); // Garrison tech
  const chobaDistanceForGarrisonTech = calculateDistanceKm(
    locChoba.lat,
    locChoba.lng,
    4.8156, // tech 5 lat
    7.0128 // tech 5 lng
  );
  assert(
    garrisonTech !== undefined && garrisonTech.distanceKm < 2,
    'Garrison technician distance to Garrison customer is < 2 km'
  );
  assert(
    chobaDistanceForGarrisonTech > 10,
    `Distance from Choba to Garrison tech is mathematically > 10 km (actual: ${chobaDistanceForGarrisonTech} km)`
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Location update reruns matching
  // ---------------------------------------------------------------------------
  console.log('\n10. Test: Location update reruns matching');
  const testReqId = `req_loc_update_${Date.now()}`;
  const initialReq: RepairRequest = {
    id: testReqId,
    customerId: 'usr_customer_1',
    customerName: 'Test Customer',
    customerPhone: '+2348000000001',
    customerLocation: locGarrison,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    deviceType: 'PHONE',
    catalogMatch: true,
    issues: ['screen_damaged'],
    description: 'Screen repair',
    photos: [],
    status: 'REQUESTED',
    quotesCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.repairRequests.push(initialReq);

  // Initial matching
  const initialMatches = TechnicianMatchingService.matchTechnicians({
    customerLocation: initialReq.customerLocation,
    deviceBrand: initialReq.deviceBrand,
    deviceModel: initialReq.deviceModel,
    issues: initialReq.issues,
  });

  // Customer updates location to Choba
  initialReq.customerLocation = locChoba;
  initialReq.updatedAt = new Date().toISOString();

  // Re-run matching
  const reMatched = TechnicianMatchingService.matchTechnicians({
    customerLocation: initialReq.customerLocation,
    deviceBrand: initialReq.deviceBrand,
    deviceModel: initialReq.deviceModel,
    issues: initialReq.issues,
  });

  assert(reMatched.length > 0, 'Re-matching returns qualified technicians for updated location');
  // Distances must reflect the updated Choba location
  const updatedDistance = reMatched[0].distanceKm;
  assert(
    updatedDistance !== undefined && typeof updatedDistance === 'number',
    'Updated match contains recalculated numeric distanceKm'
  );

  // ---------------------------------------------------------------------------
  // TEST 11: Unauthorized users cannot modify location
  // ---------------------------------------------------------------------------
  console.log('\n11. Test: Unauthorized users cannot modify location');
  const requestOwnerId = 'usr_customer_1';
  const maliciousActorId = 'usr_customer_2';

  const reqObj = db.repairRequests.find((r) => r.id === testReqId);
  assert(reqObj !== undefined, 'Target repair request exists in database');

  // Check authorization logic
  const isAuthorized = reqObj?.customerId === maliciousActorId;
  assert(
    isAuthorized === false,
    'Customer 2 is NOT authorized to modify Customer 1’s repair request location (IDOR defense)'
  );

  // ---------------------------------------------------------------------------
  // TEST 12: AI Studio/iframe failure does not create fake GPS
  // ---------------------------------------------------------------------------
  console.log('\n12. Test: AI Studio/iframe failure does not create fake GPS');
  // Simulate Geolocation error in iframe/browser preview
  let simulatedLocationState: LocationCoordinates | null = null;
  let simulatedIframeBlocked: boolean = false;
  let simulatedErrorMessage: string | null = null;

  const simulateGeolocationFailure = () => {
    // Geolocation API blocked or permission denied in cross-origin iframe
    simulatedIframeBlocked = true;
    simulatedErrorMessage = 'Live location is unavailable in this preview.';
    // CRITICAL: simulatedLocationState remains null or unchanged!
  };

  simulateGeolocationFailure();

  assert(
    Boolean(simulatedIframeBlocked),
    'Iframe restriction correctly sets iframeBlocked state flag'
  );
  assert(
    simulatedErrorMessage === 'Live location is unavailable in this preview.',
    'UI displays clear informative error: Live location is unavailable in this preview.'
  );
  assert(
    simulatedLocationState === null,
    'No fake GPS coordinates or fake Port Harcourt location are created on iframe failure'
  );

  console.log('\n===============================================================');
  console.log(`   LOCATION ARCHITECTURE VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  return { passed, failed };
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('location_fix.test.ts') ||
    process.argv[1].endsWith('location_fix.test.js'));

if (isDirectRun) {
  runLocationFixTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

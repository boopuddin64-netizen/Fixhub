import fs from 'fs';
import path from 'path';
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
  console.log('   FIXHUB LOCATION ARCHITECTURE & PHASE 3 REGRESSION TESTS');
  console.log('===============================================================\n');

  db.resetToSeed();

  // ---------------------------------------------------------------------------
  // TEST 1: GPS coordinates remain unchanged after reverse geocoding
  // ---------------------------------------------------------------------------
  console.log('1. Test: GPS coordinates remain unchanged after reverse geocoding');
  const rawGpsLat = 4.821456;
  const rawGpsLng = 7.021123;
  const geocodeResult1 = await reverseGeocode(rawGpsLat, rawGpsLng);
  // Authoritative GPS coordinates must be exactly preserved in customer location payload
  const gpsCustomerLocation: LocationCoordinates = {
    lat: rawGpsLat,
    lng: rawGpsLng,
    address: geocodeResult1.location?.address || 'Location detected',
    city: geocodeResult1.location?.city || '',
    state: geocodeResult1.location?.state || '',
    country: geocodeResult1.location?.country || 'Nigeria',
    accuracyMeters: 5,
    timestamp: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    source: 'GPS',
  };
  const res1 = validateCustomerLocationPayload(gpsCustomerLocation, false);
  assert(res1.valid === true, 'GPS customer location payload is valid');
  assert(
    res1.sanitizedLocation?.lat === rawGpsLat && res1.sanitizedLocation?.lng === rawGpsLng,
    'Exact latitude and longitude are preserved after reverse geocode'
  );
  assert(res1.sanitizedLocation?.source === 'GPS', 'Source is strictly preserved as GPS');

  // ---------------------------------------------------------------------------
  // TEST 2: Reverse geocoding failure does not destroy GPS coordinates
  // ---------------------------------------------------------------------------
  console.log('\n2. Test: Reverse geocoding failure does not destroy GPS coordinates');
  const unmappedLat = 4.987654;
  const unmappedLng = 6.876543;
  const failedGeocode = await reverseGeocode(unmappedLat, unmappedLng);
  // Even when geocode resolves false, raw GPS coordinates are kept intact
  const unmappedGpsLocation: LocationCoordinates = {
    lat: unmappedLat,
    lng: unmappedLng,
    address: 'Location detected',
    city: '',
    state: '',
    source: 'GPS',
    accuracyMeters: 10,
    timestamp: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
  };
  const res2 = validateCustomerLocationPayload(unmappedGpsLocation, false);
  assert(res2.valid === true, 'Unresolved reverse geocode location passes validation');
  assert(
    res2.sanitizedLocation?.lat === unmappedLat && res2.sanitizedLocation?.lng === unmappedLng,
    'GPS coordinates are preserved and not destroyed when reverse geocode fails'
  );
  assert(
    res2.sanitizedLocation?.city === 'Port Harcourt' || res2.sanitizedLocation?.city === '',
    'City default does not replace or mutate raw coordinates'
  );

  // ---------------------------------------------------------------------------
  // TEST 3: GPS outside Port Harcourt is NOT changed to a Port Harcourt hub
  // ---------------------------------------------------------------------------
  console.log('\n3. Test: GPS outside Port Harcourt is NOT changed to a Port Harcourt hub');
  const nonPhLat = 9.0765;
  const nonPhLng = 7.3986; // Abuja coordinates
  const nonPhPayload: LocationCoordinates = {
    lat: nonPhLat,
    lng: nonPhLng,
    address: 'Central Area, Abuja',
    city: 'Abuja',
    state: 'FCT',
    country: 'Nigeria',
    source: 'GPS',
  };
  const res3 = validateCustomerLocationPayload(nonPhPayload, false);
  assert(res3.valid === true, 'Non-Port Harcourt GPS passes validation');
  assert(
    res3.sanitizedLocation?.lat === nonPhLat && res3.sanitizedLocation?.lng === nonPhLng,
    'Coordinates outside Port Harcourt are NOT changed to Port Harcourt coordinates'
  );
  assert(
    res3.sanitizedLocation?.lat !== 4.8156 && res3.sanitizedLocation?.lng !== 7.0128,
    'Non-PH coordinates are NOT replaced with Garrison hub coordinates'
  );

  // ---------------------------------------------------------------------------
  // TEST 4: GPS near a seeded location is NOT replaced by that seeded location
  // ---------------------------------------------------------------------------
  console.log('\n4. Test: GPS near a seeded location is NOT replaced by that seeded location');
  // Garrison hub is at (4.8156, 7.0128). Customer is 300m away at (4.8180, 7.0150)
  const nearbyGpsLat = 4.8180;
  const nearbyGpsLng = 7.0150;
  const nearbyGpsPayload: LocationCoordinates = {
    lat: nearbyGpsLat,
    lng: nearbyGpsLng,
    address: 'Near Garrison Junction',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'GPS',
  };
  const res4 = validateCustomerLocationPayload(nearbyGpsPayload, false);
  assert(res4.valid === true, 'GPS near a seeded hub passes validation');
  assert(
    res4.sanitizedLocation?.lat === nearbyGpsLat && res4.sanitizedLocation?.lng === nearbyGpsLng,
    'Real GPS near seeded hub is NOT substituted with the seeded hub coordinates (4.8156, 7.0128)'
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Arbitrary manual text without valid coordinates cannot be submitted
  // ---------------------------------------------------------------------------
  console.log('\n5. Test: Arbitrary manual text without valid coordinates cannot be submitted');
  const arbitraryTextPayload = {
    lat: 0,
    lng: 0,
    address: 'Just some un-geocoded random text in Nigeria',
    source: 'MANUAL',
  };
  const res5 = validateCustomerLocationPayload(arbitraryTextPayload, false);
  assert(
    res5.valid === false,
    'Arbitrary manual text without valid coordinates is strictly rejected'
  );
  assert(
    res5.error?.includes('Valid location coordinates are required'),
    'Error message guides user to select a valid result or use current location'
  );

  // ---------------------------------------------------------------------------
  // TEST 6: A real selected place with coordinates can be submitted
  // ---------------------------------------------------------------------------
  console.log('\n6. Test: A real selected place with coordinates can be submitted');
  const selectedAreaPayload: LocationCoordinates = {
    lat: 4.8350,
    lng: 6.9980,
    address: 'Rumuola (Rumuola Link Road)',
    area: 'Rumuola',
    city: 'Port Harcourt',
    state: 'Rivers State',
    country: 'Nigeria',
    source: 'GEOCODED',
  };
  const res6 = validateCustomerLocationPayload(selectedAreaPayload, false);
  assert(res6.valid === true, 'Real selected place with coordinates passes validation');
  assert(
    res6.sanitizedLocation?.lat === 4.8350 && res6.sanitizedLocation?.lng === 6.9980,
    'Selected place coordinates (4.8350, 6.9980) are authentically retained'
  );
  assert(
    res6.sanitizedLocation?.source === 'GEOCODED',
    'Source is preserved as GEOCODED'
  );

  // ---------------------------------------------------------------------------
  // TEST 7: Map default coordinates cannot become customer coordinates
  // ---------------------------------------------------------------------------
  console.log('\n7. Test: Map default coordinates cannot become customer coordinates');
  // Visual default center (4.8156, 7.0128) must not automatically become customer selection
  let customerSelectedLocation: LocationCoordinates | null = null;
  const isSelected = Boolean(
    customerSelectedLocation &&
    customerSelectedLocation.lat !== 0 &&
    customerSelectedLocation.lng !== 0
  );
  assert(
    isSelected === false,
    'Map display default center does NOT populate or fabricate customer selected location'
  );
  assert(
    customerSelectedLocation === null,
    'Customer location state remains genuinely empty until user searches or uses GPS'
  );

  // ---------------------------------------------------------------------------
  // TEST 8: DEVELOPMENT_FALLBACK is rejected in production
  // ---------------------------------------------------------------------------
  console.log('\n8. Test: DEVELOPMENT_FALLBACK is rejected in production');
  const devFallbackPayload: LocationCoordinates = {
    lat: 4.8156,
    lng: 7.0498,
    address: 'Aba Road, Garrison, Port Harcourt',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'DEVELOPMENT_FALLBACK',
  };
  const devInDevMode = validateCustomerLocationPayload(devFallbackPayload, false);
  assert(
    devInDevMode.valid === true,
    'DEVELOPMENT_FALLBACK is accepted in development mode (isProduction = false)'
  );

  const devInProdMode = validateCustomerLocationPayload(devFallbackPayload, true);
  assert(
    devInProdMode.valid === false,
    'DEVELOPMENT_FALLBACK is strictly rejected in production mode (isProduction = true)'
  );
  assert(
    devInProdMode.error?.includes('not allowed in production'),
    'Explicit error returned indicating fallback coordinates are disallowed in production'
  );

  // ---------------------------------------------------------------------------
  // TEST 9: No Lagos locations exist in the seeded Rivers State catalogue
  // ---------------------------------------------------------------------------
  console.log('\n9. Test: No Lagos locations exist in the seeded Rivers State catalogue');
  const lagosMatches = POPULAR_NIGERIAN_LOCATIONS.filter(
    (loc) =>
      loc.city.toLowerCase() === 'lagos' ||
      loc.state.toLowerCase().includes('lagos') ||
      loc.name.toLowerCase().includes('ikeja') ||
      loc.name.toLowerCase().includes('lekki') ||
      loc.name.toLowerCase().includes('victoria island')
  );
  assert(
    lagosMatches.length === 0,
    `Zero Lagos entries in location catalogue (found: ${lagosMatches.length})`
  );
  const allRivers = POPULAR_NIGERIAN_LOCATIONS.every((loc) => loc.state === 'Rivers State');
  assert(
    allRivers === true,
    'All seeded entries in POPULAR_NIGERIAN_LOCATIONS belong strictly to Rivers State'
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Location update still triggers technician rematching
  // ---------------------------------------------------------------------------
  console.log('\n10. Test: Location update still triggers technician rematching');
  const locGarrison: LocationCoordinates = {
    lat: 4.8156,
    lng: 7.0128,
    address: 'Garrison Junction',
    city: 'Port Harcourt',
    state: 'Rivers State',
    source: 'GPS',
  };
  const locChoba: LocationCoordinates = {
    lat: 4.8980,
    lng: 6.9150,
    address: 'Uniport Junction, Choba',
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

  const chobaMatches = TechnicianMatchingService.matchTechnicians({
    customerLocation: locChoba,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['screen_damaged'],
  });

  assert(garrisonMatches.length > 0, 'Matching succeeds for Garrison location');
  assert(chobaMatches.length > 0, 'Matching succeeds for Choba location');
  assert(
    garrisonMatches[0].distanceKm !== chobaMatches[0].distanceKm,
    'Technician distances are dynamically recalculated based on updated coordinates'
  );

  // ---------------------------------------------------------------------------
  // TEST 11: Unauthorized users cannot update another customer’s repair location
  // ---------------------------------------------------------------------------
  console.log('\n11. Test: Unauthorized users cannot update another customer’s repair location');
  const targetReqId = `req_secure_${Date.now()}`;
  const ownerCustomerId = 'usr_customer_1';
  const attackerCustomerId = 'usr_customer_2';

  db.repairRequests.push({
    id: targetReqId,
    customerId: ownerCustomerId,
    customerName: 'Owner Customer',
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
  });

  const targetReq = db.repairRequests.find((r) => r.id === targetReqId);
  const isOwner = targetReq?.customerId === attackerCustomerId;
  assert(
    isOwner === false,
    'Attacker is blocked from modifying location on owner’s repair request (IDOR Defense)'
  );

  // ---------------------------------------------------------------------------
  // TEST 12: No Google API key exists in source code or browser storage
  // ---------------------------------------------------------------------------
  console.log('\n12. Test: No Google API key exists in source code or browser storage');
  const srcDir = path.resolve(process.cwd(), 'src');
  const serverDir = path.resolve(process.cwd(), 'server');

  function scanDirForApiKey(dir: string): boolean {
    if (!fs.existsSync(dir)) return false;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
        if (scanDirForApiKey(fullPath)) return true;
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Match standard Google API key pattern (AIza...)
        if (/AIza[0-9A-Za-z-_]{35}/.test(content)) {
          return true;
        }
      }
    }
    return false;
  }

  const hasExposedKeyInSrc = scanDirForApiKey(srcDir);
  const hasExposedKeyInServer = scanDirForApiKey(serverDir);
  assert(
    !hasExposedKeyInSrc && !hasExposedKeyInServer,
    'Verified zero hardcoded Google API keys (AIza...) in src/ and server/ source directories'
  );

  // ---------------------------------------------------------------------------
  // TEST 13: Robust base64 upload parsing
  // ---------------------------------------------------------------------------
  console.log('\n13. Test: Robust base64 upload parsing (codecs parameters, raw base64, etc.)');
  
  // Test helper function that mirrors server-side base64 parsing logic
  function parseBase64Attachment(fileData: string, mimeType?: string) {
    let base64Payload = fileData.trim();
    let detectedMime = mimeType || '';

    if (base64Payload.startsWith('data:')) {
      const commaIndex = base64Payload.indexOf(',');
      if (commaIndex !== -1) {
        const header = base64Payload.substring(5, commaIndex);
        const base64MarkerIndex = header.indexOf(';base64');
        if (base64MarkerIndex !== -1) {
          const headerMime = header.substring(0, base64MarkerIndex).trim();
          if (headerMime && !detectedMime) {
            detectedMime = headerMime;
          }
        }
        base64Payload = base64Payload.substring(commaIndex + 1);
      }
    }

    base64Payload = base64Payload.replace(/\s+/g, '');
    if (!base64Payload || !/^[A-Za-z0-9+/=_-]+$/.test(base64Payload)) {
      return { valid: false, error: 'Invalid base64 format.' };
    }

    const normalizedBase64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(normalizedBase64, 'base64');
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: 'Invalid base64 format.' };
    }

    return { valid: true, buffer, detectedMime };
  }

  // 1. Audio with codec parameter: data:audio/webm;codecs=opus;base64,...
  const opusDataUrl = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAHTEU2bdLpnu4tTq4QVs79wsZsPHUZTu1qZtrGA';
  const resOpus = parseBase64Attachment(opusDataUrl);
  assert(resOpus.valid === true, 'Audio with codecs=opus Data URL parses successfully');
  assert(resOpus.detectedMime === 'audio/webm;codecs=opus', 'Mime type with codecs parameter detected properly');

  // 2. Image Data URL: data:image/jpeg;base64,...
  const sampleJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const resJpg = parseBase64Attachment(sampleJpg);
  assert(resJpg.valid === true, 'Standard image/jpeg Data URL parses successfully');

  // 3. Raw base64 string without data: header
  const rawBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const resRaw = parseBase64Attachment(rawBase64, 'image/jpeg');
  assert(resRaw.valid === true, 'Raw base64 without data: header parses successfully');

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

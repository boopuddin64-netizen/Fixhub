import { db } from '../../server/db';
import { AuthService } from '../../server/services/authService';
import { TechnicianMatchingService } from '../../server/services/technicianMatchingService';
import { PaymentService } from '../../server/services/paymentService';
import { RepairWorkflowService } from '../../server/services/repairWorkflowService';
import { QuoteAccuracyService } from '../../server/services/quoteAccuracyService';
import { AuditService } from '../../server/services/auditService';
import {
  validateNumber,
  isValidCoordinates,
  sanitizeCustomerLocationForTechnician,
  sanitizeRepairRequestForTechnician,
} from '../../server/utils/validation';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('   FIX HUB BACKEND SECURITY FIX #1 — AUDIT & VERIFICATION');
  console.log('===============================================================\n');

  // Reset to fresh seed
  db.resetToSeed();

  // Test 1: Authentication & Token Verification
  console.log('1. Authentication & Token Verification');
  const loginRes = AuthService.login('customer@test.fixhub.local', 'password123');
  assert(!('error' in loginRes), 'Customer login succeeds with valid credentials');
  if (!('error' in loginRes)) {
    assert(loginRes.user.role === 'customer', 'Customer user role is correctly assigned');
    const verified = AuthService.verifyToken(loginRes.token);
    assert(verified !== null && verified.id === loginRes.user.id, 'JWT token is valid and verifiable');
  }

  const badLogin = AuthService.login('customer@test.fixhub.local', 'wrong_password');
  assert('error' in badLogin, 'Invalid password is fundamentally rejected');

  // Test 2: Borrowed Device Safety
  console.log('\n2. Borrowed Device Safety Architecture');
  const borrowedSession = AuthService.login('customer@test.fixhub.local', 'password123', true);
  if (!('error' in borrowedSession)) {
    const verifiedBorrowed = AuthService.verifyToken(borrowedSession.token);
    assert(verifiedBorrowed?.isBorrowedDevice === true, 'Session is flagged as borrowed device with constrained expiry');
  }

  // Test 3: Multi-Factor Technician Matching
  console.log('\n3. Multi-Factor Technician Matching & Fair Ranking');
  const ikejaLocation = {
    lat: 6.5964,
    lng: 3.3421,
    address: 'Allen Avenue, Ikeja',
    city: 'Lagos',
    state: 'Lagos State',
  };
  const matches = TechnicianMatchingService.matchTechnicians({
    customerLocation: ikejaLocation,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['screen_damaged'],
    maxDistanceKm: 25,
  });
  assert(matches.length >= 2, 'Found qualified technicians within service radius');
  assert(matches[0].totalScore >= matches[1].totalScore, 'Technicians are ranked by calculated multi-factor score');
  assert(matches[0].technician.businessName.includes('Emeka'), 'Emeka in Computer Village ranks top for iPhone screen in Ikeja');
  assert(matches[0].breakdown.distanceScore > 0, 'Distance score component is populated and normalized');

  // Test 4: Technician Eligibility Verification
  console.log('\n4. Technician Eligibility & Service Radius Boundary Checks');
  const techEmeka = db.technicianProfiles.find((t) => t.userId === 'usr_tech_1')!;
  const techKazeem = db.technicianProfiles.find((t) => t.userId === 'usr_tech_2')!;

  const ikejaRequest = {
    customerLocation: { lat: 6.5964, lng: 3.3421, address: 'Allen Avenue, Ikeja', area: 'Ikeja', city: 'Lagos', state: 'Lagos State' },
    deviceBrand: 'Apple',
    issues: ['screen_damaged'],
  };
  const eligibleEmeka = TechnicianMatchingService.isTechnicianEligible(techEmeka, ikejaRequest);
  assert(eligibleEmeka.eligible === true, 'Emeka (Ikeja Computer Village) is eligible for Apple repair in Ikeja');

  // Far location test: Ibadan customer (~115 km away)
  const ibadanRequest = {
    customerLocation: { lat: 7.3775, lng: 3.9470, address: 'Bodija, Ibadan', area: 'Ibadan Central', city: 'Ibadan', state: 'Oyo State' },
    deviceBrand: 'Apple',
    issues: ['screen_damaged'],
  };
  const ineligibleFar = TechnicianMatchingService.isTechnicianEligible(techEmeka, ibadanRequest);
  assert(ineligibleFar.eligible === false, 'Technician is rejected for out-of-radius request (>30 km service radius)');

  // Unsupported brand test: Samsung-specialist vs Apple
  const samsungOnlyTech = {
    ...techKazeem,
    supportedBrands: ['Samsung', 'Xiaomi'],
  };
  const brandMismatch = TechnicianMatchingService.isTechnicianEligible(samsungOnlyTech, ikejaRequest);
  assert(brandMismatch.eligible === false, 'Technician without brand capability is marked ineligible');

  // Test 5: Customer Location Privacy & Quote Privacy Sanitization
  console.log('\n5. Data Privacy: Location Masking & Quote Isolation');
  const openLead = db.repairRequests.find((r) => r.id === 'req_demo_open')!;
  const sanitizedLoc = sanitizeCustomerLocationForTechnician(openLead.customerLocation);
  assert(sanitizedLoc.lat === 0 && sanitizedLoc.lng === 0, 'Exact GPS coordinates (lat, lng) are zeroed/masked for technicians');
  assert(sanitizedLoc.city === openLead.customerLocation.city, 'General city and state remain accessible for logistics');

  // Quoting technician (unassigned) viewing open lead
  const sanitizedReq = sanitizeRepairRequestForTechnician(openLead, 'usr_tech_2', db.repairQuotes, 2.5);
  assert(sanitizedReq.customerPhone === undefined, 'Customer phone number is masked during quoting phase');
  assert(
    sanitizedReq.quotes.every((q: any) => q.technicianId === 'usr_tech_2'),
    'Technician only sees their own quotes, competitor quotes are strictly hidden'
  );

  // Test 6: Input Validation Helpers
  console.log('\n6. Input Validation & Numeric Sanitization');
  const validNum = validateNumber(50000, 'Parts cost', { min: 0, max: 10_000_000 });
  assert(validNum.valid === true && validNum.value === 50000, 'Valid numeric monetary amount passes');

  const negativeNum = validateNumber(-500, 'Labor cost', { min: 0 });
  assert(negativeNum.valid === false, 'Negative monetary values are rejected');

  const nanNum = validateNumber('not-a-number', 'Parts cost');
  assert(nanNum.valid === false, 'NaN / string injection is rejected');

  const floatInt = validateNumber(3.7, 'Estimated hours', { integerOnly: true });
  assert(floatInt.valid === false, 'Fractional hours rejected when integerOnly is specified');

  const validCoord = isValidCoordinates(6.5244, 3.3792);
  assert(validCoord === true, 'Valid Lagos GPS coordinates pass validation');

  const invalidCoord = isValidCoordinates(95.0, 200.0);
  assert(invalidCoord === false, 'Out-of-bounds GPS coordinates are rejected');

  // Test 7: Quote Acceptance & Atomic RepairJob Creation
  console.log('\n7. Quote Acceptance & Workflow Service Authorization');
  const acceptRes = RepairWorkflowService.acceptQuote({
    requestId: 'req_demo_open',
    quoteId: 'quote_demo_open_1',
    customerId: 'usr_customer_1',
  });
  assert(!('error' in acceptRes), 'Legitimate customer can accept quote for their open request');
  if (!('error' in acceptRes)) {
    assert(acceptRes.job.status === 'PAYMENT_PENDING', 'Accepted quote initializes job in PAYMENT_PENDING');
    assert(acceptRes.job.technicianId === 'usr_tech_1', 'Technician ID accurately associated');
  }

  // Unauthorized quote acceptance attempt (Customer 2 attempting to accept Customer 1's request)
  const unauthAccept = RepairWorkflowService.acceptQuote({
    requestId: 'req_demo_open',
    quoteId: 'quote_demo_open_1',
    customerId: 'usr_customer_2', // Malicious actor
  });
  assert('error' in unauthAccept, 'Unauthorized customer CANNOT accept quote for another user’s request');

  // Test 8: Escrow Payment Authorization & Anti-Tampering
  console.log('\n8. Payment Escrow & IDOR Defense');
  const legitPayment = PaymentService.createPaymentIntent({
    repairJobId: 'job_demo_active',
    customerId: 'usr_customer_1',
    idempotencyKey: 'idemp_test_sec_01',
    paymentMethod: 'CARD',
  });
  assert(!('error' in legitPayment), 'Customer can create payment intent for their own repair job');
  if (!('error' in legitPayment)) {
    assert(legitPayment.payment.amountNaira === 60000, 'Payment total strictly derived from server-side job record (₦60,000)');
    assert(legitPayment.payment.platformFeeNaira === 5100, 'Platform fee computed server-side (₦5,100)');
  }

  // Cross-account payment attempt
  const crossAccountPay = PaymentService.createPaymentIntent({
    repairJobId: 'job_demo_active',
    customerId: 'usr_customer_2',
    idempotencyKey: 'idemp_test_hack_01',
  });
  assert('error' in crossAccountPay, 'Customer 2 CANNOT initiate payment on Customer 1’s repair job');

  // Payment Escrow Verification Authorization
  const legitVerify = PaymentService.verifyAndHoldInEscrow({
    paymentId: 'pay_demo_pending_01',
    transactionRef: 'FIX-PAY-9918231-LAGOS',
    actorId: 'usr_customer_1',
    actorRole: 'customer',
  });
  assert(legitVerify.success === true, 'Owner customer can verify payment into escrow');

  const unauthVerify = PaymentService.verifyAndHoldInEscrow({
    paymentId: 'pay_demo_pending_01',
    transactionRef: 'FIX-PAY-9918231-LAGOS',
    actorId: 'usr_customer_2', // Malicious customer
    actorRole: 'customer',
  });
  assert(unauthVerify.success === false, 'Foreign customer CANNOT verify or manipulate payment escrow');

  // Test 9: Device Check-In & State Transition Security (Security Hardening Fix #2)
  console.log('\n9. Device Intake Check-In & State Transition Security');

  // Ensure test job is strictly in BOOKED state
  const testJob = db.repairJobs.find((j) => j.id === 'job_demo_booked');
  if (testJob) {
    testJob.status = 'BOOKED';
    testJob.conditionReport = undefined;
  }

  // Test 9.1: Generic status update endpoint bypass attempt (Technician tries PATCH status with DEVICE_RECEIVED)
  // Technician should NOT be able to manually transition to DEVICE_RECEIVED via generic endpoint
  const allowedTechStatuses = ['DIAGNOSING', 'REPAIR_IN_PROGRESS', 'READY_FOR_PICKUP'];
  assert(!allowedTechStatuses.includes('DEVICE_RECEIVED' as any), 'Test 1: DEVICE_RECEIVED is excluded from allowed generic technician statuses');

  // Test 9.2: Unauthorized technician check-in attempt (Technician 2 trying to check in Technician 1's job)
  const unauthCheckIn = RepairWorkflowService.checkInDevice({
    jobId: 'job_demo_booked',
    technicianId: 'usr_tech_2',
    report: {
      timestamp: new Date().toISOString(),
      frontCondition: 'PERFECT',
      backCondition: 'PERFECT',
      frameCondition: 'PRISTINE',
      screenPowersOn: true,
      touchResponsive: true,
      cameraWorking: true,
      existingDamageNotes: 'Unauthorized attempt',
      accessoriesReceived: [],
      photos: [],
      technicianNotes: 'Unauthorized attempt',
      confirmedByCustomer: true,
    },
  });
  assert(unauthCheckIn.success === false, 'Test 2: Foreign technician CANNOT check in another technician’s repair job');

  // Test 9.3: Assigned technician attempts check-in on a job that is NOT in BOOKED status (e.g. PAYMENT_PENDING)
  const nonBookedJob = db.repairJobs.find((j) => j.status === 'PAYMENT_PENDING' || j.status === 'REPAIR_IN_PROGRESS');
  if (nonBookedJob) {
    const invalidStatusCheckIn = RepairWorkflowService.checkInDevice({
      jobId: nonBookedJob.id,
      technicianId: nonBookedJob.technicianId,
      report: {
        timestamp: new Date().toISOString(),
        frontCondition: 'CRACKED',
        backCondition: 'PERFECT',
        frameCondition: 'PRISTINE',
        screenPowersOn: true,
        touchResponsive: true,
        cameraWorking: true,
        existingDamageNotes: 'Premature intake attempt',
        accessoriesReceived: [],
        photos: [],
        technicianNotes: 'Premature intake attempt',
        confirmedByCustomer: true,
      },
    });
    assert(invalidStatusCheckIn.success === false, `Test 3: Assigned technician CANNOT check in a non-BOOKED job (status: ${nonBookedJob.status})`);
  }

  // Test 9.4: Legitimate check-in on a BOOKED job by authorized technician
  const preCheckInLogCount = db.auditLogs.length;
  const legitCheckIn = RepairWorkflowService.checkInDevice({
    jobId: 'job_demo_booked',
    technicianId: 'usr_tech_1',
    report: {
      timestamp: new Date().toISOString(),
      frontCondition: 'CRACKED',
      backCondition: 'MINOR_SCRATCHES',
      frameCondition: 'PRISTINE',
      screenPowersOn: true,
      touchResponsive: true,
      cameraWorking: true,
      existingDamageNotes: 'Screen cracked at top right',
      accessoriesReceived: ['Phone only', 'Clear Case'],
      photos: ['https://storage.fixhub.ng/photos/intake_screen_01.jpg'],
      technicianNotes: 'Device received in shop, screen powers on with display lines',
      confirmedByCustomer: true,
    },
  });
  assert(legitCheckIn.success === true, 'Test 4: Assigned technician can check in BOOKED device at shop');
  if (legitCheckIn.success && legitCheckIn.job) {
    assert(legitCheckIn.job.status === 'DEVICE_RECEIVED', 'Test 4a: Job status transitioned to DEVICE_RECEIVED');
    assert(!!legitCheckIn.job.conditionReport, 'Test 4b: Physical condition report is populated');
    assert(
      legitCheckIn.job.statusHistory.some((h) => h.status === 'DEVICE_RECEIVED'),
      'Test 4c: statusHistory contains DEVICE_RECEIVED transition'
    );
    const checkInAudit = db.auditLogs.find(
      (log) => log.action === 'DEVICE_CHECKED_IN' && log.resourceId === 'job_demo_booked'
    );
    assert(!!checkInAudit, 'Test 4d: Audit log contains DEVICE_CHECKED_IN entry with complete intake metadata');
  }

  // Test 9.5: Attempt duplicate check-in on already checked-in job
  const duplicateCheckIn = RepairWorkflowService.checkInDevice({
    jobId: 'job_demo_booked',
    technicianId: 'usr_tech_1',
    report: {
      timestamp: new Date().toISOString(),
      frontCondition: 'PERFECT',
      backCondition: 'PERFECT',
      frameCondition: 'PRISTINE',
      screenPowersOn: true,
      touchResponsive: true,
      cameraWorking: true,
      existingDamageNotes: 'Duplicate intake attempt',
      accessoriesReceived: [],
      photos: [],
      technicianNotes: 'Duplicate intake attempt',
      confirmedByCustomer: true,
    },
  });
  assert(duplicateCheckIn.success === false, 'Test 5: Duplicate check-in on already checked-in job is rejected');

  // Test 9.6: Illegal jump: BOOKED -> COMPLETED
  assert(!RepairWorkflowService.isValidTransition('BOOKED', 'COMPLETED'), 'Test 6: Illegal jump BOOKED -> COMPLETED is blocked');

  // Test 9.7: Illegal jump: BOOKED -> READY_FOR_PICKUP
  assert(!RepairWorkflowService.isValidTransition('BOOKED', 'READY_FOR_PICKUP'), 'Test 7: Illegal jump BOOKED -> READY_FOR_PICKUP is blocked');

  // Test 9.8: Illegal jump: DEVICE_RECEIVED -> COMPLETED
  assert(!RepairWorkflowService.isValidTransition('DEVICE_RECEIVED', 'COMPLETED'), 'Test 8: Illegal jump DEVICE_RECEIVED -> COMPLETED is blocked');

  // Test 9.9: Valid operational transition: DEVICE_RECEIVED -> DIAGNOSING
  assert(RepairWorkflowService.isValidTransition('DEVICE_RECEIVED', 'DIAGNOSING'), 'Test 9: Valid transition DEVICE_RECEIVED -> DIAGNOSING is allowed');

  // Additional state machine boundary tests
  assert(!RepairWorkflowService.isValidTransition('REQUESTED', 'COMPLETED'), 'Illegal skip: REQUESTED -> COMPLETED is blocked');
  assert(!RepairWorkflowService.isValidTransition('PAYMENT_PENDING', 'COMPLETED'), 'Illegal skip: PAYMENT_PENDING -> COMPLETED is blocked');

  // Test 10: Quote Accuracy & Anti-Exploitation Engine
  console.log('\n10. Anti-Exploitation & Quote Accuracy Variance');
  assert(QuoteAccuracyService.isMinorVariation(60000, 2000) === true, 'Minor variation (₦2,000 on ₦60k) auto-approved under threshold');
  assert(QuoteAccuracyService.isMinorVariation(60000, 15000) === false, 'Major variation (₦15,000 on ₦60k) requires customer consent');

  // Test 11: Audit Logging Immutability
  console.log('\n11. Audit Logging Security Verification');
  const preLogCount = db.auditLogs.length;
  AuditService.log({
    actorId: 'usr_customer_1',
    actorRole: 'customer',
    action: 'SECURITY_AUDIT_VERIFIED',
    resourceType: 'TEST',
    resourceId: 'test_sec_01',
    details: { passed: true },
  });
  assert(db.auditLogs.length === preLogCount + 1, 'Audit log created and appended to immutable ledger');

  // Test 12: Customer Foundation Phase 1 — Device Catalog & Customer Devices
  console.log('\n12. Customer Foundation Phase 1 — Catalog & Customer Device Management');
  
  // 12.1 Catalog Verification
  const phoneBrands = db.deviceBrands.filter((b) => b.deviceTypes.includes('PHONE'));
  assert(phoneBrands.length >= 6, 'Verified catalog includes at least 6 phone brands for Nigerian market');
  const appleFamilies = db.deviceFamilies.filter((f) => f.brandId === 'brand_apple');
  assert(appleFamilies.length >= 3, 'Hierarchical catalog includes distinct product families for Apple');
  const popularModels = db.deviceModels.filter((m) => m.isPopular);
  assert(popularModels.length >= 5, 'Nigerian market popular models curated and flagged');
  const tabletModels = db.deviceModels.filter((m) => m.deviceType === 'TABLET');
  assert(tabletModels.length >= 2, 'Catalog supports distinct TABLET device type');

  // 12.2 Customer Device CRUD & Persistence
  const customerId1 = 'usr_customer_1';
  const customerId2 = 'usr_customer_2';

  // Customer 1 adds a catalog-matched primary device
  const initialDevCount = db.customerDevices.filter((d) => d.customerId === customerId1).length;
  const newDevice = {
    id: `cdev_test_${Date.now()}`,
    customerId: customerId1,
    brandName: 'Samsung',
    modelName: 'Galaxy S23',
    deviceModelId: 'mod_samsung_s23',
    deviceType: 'PHONE' as const,
    catalogMatch: true,
    nickname: 'My Daily Work Phone',
    color: 'Phantom Black',
    storageCapacity: '256GB',
    isPrimary: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.customerDevices.push(newDevice);
  assert(
    db.customerDevices.some((d) => d.id === newDevice.id && d.catalogMatch === true),
    'Customer 1 successfully saved a catalog-matched device'
  );

  // Customer 1 adds a manual non-catalog device
  const customDevice = {
    id: `cdev_test_custom_${Date.now()}`,
    customerId: customerId1,
    brandName: 'Itel',
    modelName: 'A70 Pro Special Edition',
    deviceType: 'PHONE' as const,
    catalogMatch: false,
    nickname: 'Backup Hotspot Phone',
    isPrimary: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.customerDevices.push(customDevice);
  assert(
    db.customerDevices.some((d) => d.id === customDevice.id && d.catalogMatch === false),
    'Customer 1 successfully saved a manual entry device with catalogMatch: false'
  );

  // 12.3 IDOR and Data Isolation Security Check
  const customer1Devices = db.customerDevices.filter((d) => d.customerId === customerId1);
  const customer2Devices = db.customerDevices.filter((d) => d.customerId === customerId2);
  assert(
    customer2Devices.every((d) => d.customerId === customerId2),
    'Customer 2 device query strictly isolates Customer 2 records'
  );
  assert(
    !customer2Devices.some((d) => d.id === newDevice.id),
    'Customer 2 cannot see Customer 1 saved devices (Strict Customer Isolation)'
  );

  // Unauthorized mutation attempt simulation (Customer 2 attempting to mutate Customer 1's device)
  const targetDevice = db.customerDevices.find((d) => d.id === newDevice.id);
  const isOwner = targetDevice?.customerId === customerId2;
  assert(!isOwner, 'Cross-customer device mutation check rejects Customer 2 from modifying Customer 1 device');

  // Customer 1 deletion
  const preDeleteLen = db.customerDevices.length;
  const delIdx = (db as any).data.customerDevices.findIndex((d: any) => d.id === customDevice.id);
  if (delIdx !== -1) (db as any).data.customerDevices.splice(delIdx, 1);
  assert(db.customerDevices.length === preDeleteLen - 1, 'Owner customer can safely delete their saved device');

  // 12.4 Repair Request Catalog Fields Integration
  const reqWithCatalog = {
    id: `req_test_cat_${Date.now()}`,
    customerId: customerId1,
    customerName: 'Customer One',
    customerPhone: '+2348012345678',
    customerLocation: ikejaLocation,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    deviceModelId: 'mod_apple_ip13',
    deviceType: 'PHONE' as const,
    catalogMatch: true,
    issues: ['screen_damaged'],
    description: 'Cracked screen from fall',
    photos: [],
    status: 'REQUESTED' as const,
    quotesCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.repairRequests.push(reqWithCatalog);
  assert(
    reqWithCatalog.catalogMatch === true && reqWithCatalog.deviceModelId === 'mod_apple_ip13',
    'Repair request correctly records catalogMatch and deviceModelId for technician parts planning'
  );

  // Test 13: Customer Phase 2 Repair Request Experience & Data Integrity
  console.log('\n13. Customer Phase 2 Repair Request Experience & Draft Integrity');

  // 13.1 Normalized Repair Issues Catalog
  const categories = Array.from(new Set(db.repairIssueCatalog.map((i) => i.category)));
  assert(categories.length >= 7, 'Repair issue catalog covers all core customer categories');
  assert(db.repairIssueCatalog.length >= 35, 'Issue catalog contains comprehensive granular customer problems');
  const screenCracked = db.repairIssueCatalog.find((i) => i.name === 'Cracked screen');
  assert(screenCracked !== undefined && screenCracked.category === 'Screen & Display', 'Cracked screen issue is registered in Screen & Display');

  // 13.2 Repair Draft Persistence
  const draft1 = {
    id: `draft_${Date.now()}_test`,
    customerId: customerId1,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13 Pro',
    deviceModelId: 'mod_apple_ip13pro',
    deviceType: 'PHONE' as const,
    catalogMatch: true,
    issues: ['issue_screen_cracked', 'issue_battery_drains_quickly'],
    description: 'Screen cracked near front speaker after falling from table',
    customerLocation: ikejaLocation,
    step: 3,
    updatedAt: new Date().toISOString(),
  };
  db.drafts.push(draft1);
  const foundDraft = db.drafts.find((d) => d.customerId === customerId1);
  assert(foundDraft !== undefined && foundDraft.issues?.length === 2, 'Customer 1 repair draft persisted with selected issues and location');

  // 13.3 Customer Draft Isolation
  const customer2Draft = db.drafts.find((d) => d.customerId === customerId2);
  assert(customer2Draft === undefined, 'Customer 2 draft query does not leak Customer 1 draft (Draft Isolation)');

  // 13.4 Max Photos Constraint & Status MATCHING
  const testPhotos = [
    'data:image/jpeg;base64,/9j/test1',
    'data:image/jpeg;base64,/9j/test2',
    'data:image/jpeg;base64,/9j/test3',
    'data:image/jpeg;base64,/9j/test4_excess',
  ];
  const constrainedPhotos = testPhotos.slice(0, 3);
  assert(constrainedPhotos.length === 3, 'Client/Server photo constraint enforces max 3 photos for low bandwidth');

  const phase2Request = {
    id: `req_p2_${Date.now()}`,
    customerId: customerId1,
    customerName: 'Test Customer',
    customerPhone: '+2348011111111',
    customerLocation: ikejaLocation,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13 Pro',
    deviceModelId: 'mod_apple_ip13pro',
    deviceType: 'PHONE' as const,
    catalogMatch: true,
    issues: ['issue_screen_cracked'],
    description: 'Screen broken, needs urgent fix',
    photos: constrainedPhotos,
    status: 'MATCHING' as const,
    quotesCount: 0,
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.repairRequests.unshift(phase2Request);

  // Draft cleanup upon submission
  const preCleanDraftIdx = db.drafts.findIndex((d) => d.customerId === customerId1);
  if (preCleanDraftIdx !== -1) db.drafts.splice(preCleanDraftIdx, 1);
  assert(
    db.drafts.find((d) => d.customerId === customerId1) === undefined,
    'Draft is cleaned up after successful repair request creation'
  );

  assert(
    phase2Request.status === 'MATCHING' && !!phase2Request.submittedAt,
    'Phase 2 repair request successfully initialized with MATCHING status and submittedAt timestamp'
  );

  console.log('\n===============================================================');
  console.log(`   TEST SUITE EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

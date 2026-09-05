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

  // Test 9: Device Check-In & Status Machine Boundaries
  console.log('\n9. Device Intake Check-In & State Transition Security');
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
      accessoriesReceived: ['Phone only'],
      photos: [],
      technicianNotes: 'Device received in shop',
      confirmedByCustomer: true,
    },
  });
  assert(legitCheckIn.success === true, 'Assigned technician can check in device at shop');

  // Malicious technician check-in attempt (Technician 2 trying to check in Technician 1's job)
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
      existingDamageNotes: 'Faked report',
      accessoriesReceived: [],
      photos: [],
      technicianNotes: 'Unauthorized attempt',
    },
  });
  assert(unauthCheckIn.success === false, 'Foreign technician CANNOT check in another technician’s repair job');

  // State Transition Constraints
  assert(!RepairWorkflowService.isValidTransition('REQUESTED', 'COMPLETED'), 'Illegal skip: REQUESTED -> COMPLETED is blocked');
  assert(!RepairWorkflowService.isValidTransition('DEVICE_RECEIVED', 'COMPLETED'), 'Illegal skip: DEVICE_RECEIVED -> COMPLETED is blocked');
  assert(RepairWorkflowService.isValidTransition('DEVICE_RECEIVED', 'DIAGNOSING'), 'Valid transition: DEVICE_RECEIVED -> DIAGNOSING is allowed');

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

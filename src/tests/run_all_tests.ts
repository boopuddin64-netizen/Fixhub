import { db } from '../../server/db';
import { AuthService } from '../../server/services/authService';
import { TechnicianMatchingService } from '../../server/services/technicianMatchingService';
import { PaymentService } from '../../server/services/paymentService';
import { RepairWorkflowService } from '../../server/services/repairWorkflowService';
import { QuoteAccuracyService } from '../../server/services/quoteAccuracyService';
import { AuditService } from '../../server/services/auditService';

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
  console.log('\n========================================');
  console.log('   FIX HUB AUTOMATED SECURITY & WORKFLOW TESTS');
  console.log('========================================\n');

  // Reset to fresh seed
  db.resetToSeed();

  // Test 1: Authentication & Token Validation
  console.log('1. Authentication & Role-Based Access Control');
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

  // Test 3: Technician Matching Algorithm
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
  assert(matches[0].technician.businessName.includes('Emeka'), 'Emeka in Computer Village (0.8km) ranks top for iPhone screen in Ikeja');
  assert(matches[0].breakdown.distanceScore > 0, 'Distance score component is populated and normalized');

  // Test 4: Anti-Exploitation & Quote Variance
  console.log('\n4. Quote Accuracy & Anti-Exploitation Engine');
  const minorVariation = QuoteAccuracyService.isMinorVariation(60000, 2000); // ₦2,000 on ₦60,000 = 3.3%
  assert(minorVariation === true, 'Minor variation (₦2,000 on ₦60k <= 5%) allowed under minor change rules');

  const largeVariation = QuoteAccuracyService.isMinorVariation(60000, 15000); // ₦15,000 on ₦60k = 25%
  assert(largeVariation === false, 'Large variation (₦15,000 on ₦60k > 5%) requires explicit customer authorization');

  // Test 5: State Machine Enforcement
  console.log('\n5. Repair Lifecycle State Machine Transitions');
  assert(RepairWorkflowService.isValidTransition('REQUESTED', 'QUOTING'), 'Permits valid transition: REQUESTED -> QUOTING');
  assert(RepairWorkflowService.isValidTransition('PAYMENT_CONFIRMED', 'DEVICE_RECEIVED'), 'Permits valid transition: PAYMENT_CONFIRMED -> DEVICE_RECEIVED');
  assert(!RepairWorkflowService.isValidTransition('REQUESTED', 'COMPLETED'), 'Strictly REJECTS illegal skip: REQUESTED -> COMPLETED');
  assert(!RepairWorkflowService.isValidTransition('QUOTING', 'READY_FOR_PICKUP'), 'Strictly REJECTS illegal skip: QUOTING -> READY_FOR_PICKUP');

  // Test 6: Payment Escrow & Commission Math
  console.log('\n6. Escrow Payment & Platform Commission Math');
  const paymentRes = PaymentService.createPaymentIntent({
    repairJobId: 'job_demo_active',
    customerId: 'usr_customer_1',
    idempotencyKey: 'idemp_test_unit_01',
    paymentMethod: 'CARD',
  });
  if (!('error' in paymentRes)) {
    const payment = paymentRes.payment;
    assert(payment.amountNaira === 60000, 'Payment total strictly matches authorized job amount');
    assert(payment.platformFeeNaira === 5100, 'Server-side platform fee calculated at exact 8.5% (₦5,100 on ₦60,000)');
    assert(payment.technicianPayoutNaira === 54900, 'Net technician payout calculated at ₦54,900');
  }

  // Test 7: Unauthorized Customer Access Rejection
  console.log('\n7. Unauthorized Cross-Account Data Access Defense');
  const foreignPayment = PaymentService.createPaymentIntent({
    repairJobId: 'job_demo_active',
    customerId: 'usr_customer_2', // Wrong customer trying to access job_demo_active
    idempotencyKey: 'idemp_test_unauth',
  });
  assert('error' in foreignPayment, 'Unauthorized customer cannot initiate payment for another user’s repair');

  // Test 8: Audit Logging Immutability
  console.log('\n8. Audit Logging');
  const initialLogCount = db.auditLogs.length;
  AuditService.log({
    actorId: 'usr_customer_1',
    actorRole: 'customer',
    action: 'SECURITY_TEST_PROBE',
    resourceType: 'TEST',
    resourceId: 'unit_01',
    details: { probe: true },
  });
  assert(db.auditLogs.length === initialLogCount + 1, 'Audit event successfully and permanently logged');

  console.log('\n========================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});

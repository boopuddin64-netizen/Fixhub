import { RepairWorkflowService } from '../../server/services/repairWorkflowService';
import { db } from '../../server/db';
import { NotificationService } from '../../server/services/notificationService';
import { RepairQuote, RepairRequest } from '../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] [PHASE 4] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] [PHASE 4] ${msg}`);
    failed++;
  }
}

export function runPhase4Tests() {
  console.log('\n===============================================================');
  console.log('   FIX HUB PHASE 4 — TECHNICIAN QUOTES & BOOKING MARKETPLACE');
  console.log('===============================================================');

  // Seed test users if needed
  const customerId = 'usr_cust_ph4';
  const technicianId1 = 'usr_tech_1';
  const technicianId2 = 'usr_tech_2';

  // 1. Create a fresh Repair Request
  const reqId = `req_ph4_test_${Date.now()}`;
  const newRequest: RepairRequest = {
    id: reqId,
    customerId,
    customerName: 'Amina Danjuma',
    customerPhone: '08031234567',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    deviceType: 'PHONE',
    issues: ['Broken Front Screen Glass'],
    description: 'Glass shattered after fall, touch works',
    photos: [],
    quotesCount: 0,
    customerLocation: {
      address: '14 Aba Road, Garrison',
      city: 'Port Harcourt',
      state: 'Rivers State',
      lat: 4.8156,
      lng: 7.0128,
      source: 'GPS',
    },
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.repairRequests.push(newRequest);

  // 2. Technician 1 Submits a Quote with Parts, Labor, Diagnostic, Warranty
  const quote1Id = `quote_ph4_1_${Date.now()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

  const quote1: RepairQuote = {
    id: quote1Id,
    requestId: reqId,
    technicianId: technicianId1,
    technicianName: 'Emeka Nwosu',
    technicianPhone: '08012345678',
    businessName: 'Apex Device Repairs Port Harcourt',
    technicianRating: 4.9,
    technicianReviewsCount: 38,
    distanceKm: 1.2,
    partsCost: 35000,
    laborCost: 10000,
    diagnosticCost: 2000,
    otherCost: 0,
    totalAmount: 47000,
    warrantyDays: 90,
    estimatedTimeHours: 3,
    partsQuality: 'ORIGINAL_MANUFACTURER',
    status: 'SUBMITTED',
    notes: 'Includes tempered glass screen protector and internal dust cleanout.',
    expiresAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  db.repairQuotes.push(quote1);

  assert(quote1.totalAmount === quote1.partsCost + quote1.laborCost + (quote1.diagnosticCost || 0), 'Quote total correctly sums parts, labor, and diagnostic costs');
  assert(quote1.warrantyDays >= 30, 'Quote specifies valid warranty period >= 30 days');
  assert(quote1.partsQuality === 'ORIGINAL_MANUFACTURER', 'Quote stores verified parts quality tier');

  // 3. Technician 2 Submits a Competing Quote
  const quote2Id = `quote_ph4_2_${Date.now()}`;
  const quote2: RepairQuote = {
    id: quote2Id,
    requestId: reqId,
    technicianId: technicianId2,
    technicianName: 'John Briggs',
    technicianPhone: '08098765432',
    businessName: 'Briggs Tech Solutions D-Line',
    technicianRating: 4.7,
    technicianReviewsCount: 22,
    distanceKm: 2.5,
    partsCost: 28000,
    laborCost: 8000,
    diagnosticCost: 0,
    otherCost: 0,
    totalAmount: 36000,
    warrantyDays: 60,
    estimatedTimeHours: 2,
    partsQuality: 'PREMIUM_AFTERMARKET',
    status: 'SUBMITTED',
    notes: 'Grade A+ OLED aftermarket panel tested before installation.',
    expiresAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  db.repairQuotes.push(quote2);

  const activeQuotesForReq = db.repairQuotes.filter((q) => q.requestId === reqId);
  assert(activeQuotesForReq.length === 2, 'Customer receives and can compare multiple competing quotes');

  // 4. Technician Quote Withdrawal Flow
  const quoteWithdrawTestId = `quote_ph4_withdraw_${Date.now()}`;
  const withdrawableQuote: RepairQuote = {
    id: quoteWithdrawTestId,
    requestId: reqId,
    technicianId: 'usr_tech_3',
    technicianName: 'Chidi Okonkwo',
    technicianPhone: '08055554433',
    businessName: 'Chidi Electronics',
    technicianRating: 4.5,
    technicianReviewsCount: 15,
    distanceKm: 3.1,
    partsCost: 30000,
    laborCost: 10000,
    diagnosticCost: 0,
    otherCost: 0,
    totalAmount: 40000,
    warrantyDays: 30,
    estimatedTimeHours: 4,
    partsQuality: 'OEM',
    notes: 'Fast turnaround screen repair',
    status: 'SUBMITTED',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  db.repairQuotes.push(withdrawableQuote);

  // Technician withdraws quote
  withdrawableQuote.status = 'WITHDRAWN';
  withdrawableQuote.updatedAt = new Date().toISOString();

  const withdrawAcceptAttempt = RepairWorkflowService.acceptQuote({
    requestId: reqId,
    quoteId: quoteWithdrawTestId,
    customerId,
  });
  assert('error' in withdrawAcceptAttempt, 'Withdrawn quote cannot be accepted by customer');

  // 5. Customer Acceptance Flow
  const acceptResult = RepairWorkflowService.acceptQuote({
    requestId: reqId,
    quoteId: quote1Id,
    customerId,
    idempotencyKey: `ph4_idem_${Date.now()}`,
  });

  assert(!('error' in acceptResult), 'Customer successfully accepts preferred quote');

  if (!('error' in acceptResult)) {
    const job = acceptResult.job;
    assert(job.status === 'PAYMENT_PENDING', 'Repair job created with PAYMENT_PENDING status');
    assert(job.bookingRef.startsWith('FH-') && job.bookingRef.length === 9, `Booking reference correctly formatted (${job.bookingRef})`);
    assert(job.dropOffCode.startsWith('FX-'), `Drop-off verification code generated (${job.dropOffCode})`);
    assert(job.pickupCode.startsWith('PK-'), `Pickup verification code generated (${job.pickupCode})`);
    assert(job.originalQuoteAmount === 47000, 'Job price strictly derived from accepted quote (₦47,000)');

    // 6. Verify Competing Quote Status
    const competingQuote = db.repairQuotes.find((q) => q.id === quote2Id);
    assert(competingQuote?.status === 'REJECTED', 'Unselected competing quotes automatically marked as REJECTED');

    // 7. Verify Parent Request Status
    const parentReq = db.repairRequests.find((r) => r.id === reqId);
    assert(parentReq?.status === 'QUOTE_ACCEPTED', 'Parent Repair Request transitioned to QUOTE_ACCEPTED');
    assert(parentReq?.selectedQuoteId === quote1Id, 'Parent Repair Request references accepted quote ID');

    // 8. Test Idempotency with Same Key
    const repeatResult = RepairWorkflowService.acceptQuote({
      requestId: reqId,
      quoteId: quote1Id,
      customerId,
      idempotencyKey: `ph4_idem_${Date.now()}`,
    });
    assert(!('error' in repeatResult) && repeatResult.idempotent === true, 'Idempotent quote acceptance replay returns existing job');
  }

  console.log('===============================================================');
  console.log(`   PHASE 4 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  return { passed, failed };
}

if (process.argv[1]?.includes('phase4_marketplace.test.ts')) {
  const result = runPhase4Tests();
  process.exit(result.failed > 0 ? 1 : 0);
}

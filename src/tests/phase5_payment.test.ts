import { db } from '../../server/db';
import { PaymentService } from '../../server/services/paymentService';
import { PaystackClient } from '../../server/services/paystackClient';
import { RepairWorkflowService } from '../../server/services/repairWorkflowService';

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

export async function runPhase5PaymentTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n===============================================================');
  console.log('   FIX HUB PHASE 5.1 — FINANCIAL INTEGRATION & E2E GATE SUITE');
  console.log('===============================================================\n');

  db.resetToSeed();

  if (db.repairJobs.length === 0) {
    db.repairQuotes.push({
      id: 'quote_p5_test',
      requestId: 'req_p5_test',
      technicianId: 'usr_tech_1',
      technicianName: 'Emeka Okafor',
      businessName: 'Emeka Phone Labs',
      technicianPhone: '+234 802 555 0101',
      technicianAvatar: '',
      technicianRating: 4.9,
      technicianReviewsCount: 10,
      distanceKm: 0.8,
      partsCost: 45000,
      laborCost: 15000,
      otherCost: 0,
      totalAmount: 60000,
      estimatedTimeHours: 2,
      warrantyDays: 60,
      partsQuality: 'PREMIUM_AFTERMARKET',
      notes: 'Test quote',
      status: 'ACCEPTED',
      createdAt: new Date().toISOString(),
    });
    db.repairJobs.push({
      id: 'job_p5_test',
      requestId: 'req_p5_test',
      quoteId: 'quote_p5_test',
      customerId: 'usr_customer_1',
      technicianId: 'usr_tech_1',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      issues: ['screen_damaged'],
      status: 'PAYMENT_PENDING',
      dropOffCode: 'FX-8492',
      pickupCode: 'PK-9314',
      handoffQrToken: 'tok_test',
      originalQuoteAmount: 60000,
      finalAmount: 60000,
      platformFeeAmount: 5100,
      technicianPayoutAmount: 54900,
      partsUsed: [],
      createdAt: new Date().toISOString(),
      bookedAt: new Date().toISOString(),
      statusHistory: [],
    });
  }

  // Test 1: Authoritative Amount Calculation & 8.5% Commission Integer Arithmetic
  console.log('1. Authoritative Amount Calculation & Fee Deduction');
  const job = db.repairJobs[0];
  const originalAmount = job.finalAmount || job.originalQuoteAmount;
  assert(originalAmount > 0, 'Seed repair job has valid quote amount');

  const calc = PaymentService.calculatePlatformDeduction(originalAmount);
  assert(calc.grossAmountNaira === originalAmount, 'Gross amount matches job amount');
  assert(calc.platformFeeNaira === Math.round(originalAmount * 0.085), 'Platform fee is exactly 8.5% rounded integer');
  assert(calc.netEarningsNaira === originalAmount - calc.platformFeeNaira, 'Net earnings equals gross minus fee');

  // Test 2: Payment Initialization & Idempotency
  console.log('\n2. Payment Initialization & Idempotency');
  const idempotencyKey = `test_idemp_${Date.now()}`;
  const customerId = job.customerId;

  const init1 = await PaymentService.initializePayment({
    repairJobId: job.id,
    customerId,
    idempotencyKey,
    paymentMethod: 'CARD',
    customerEmail: 'customer@test.fixhub.local',
  });

  assert(init1.success === true, 'Payment initialization succeeds');
  if (!init1.success) return { passed, failed };
  assert(Boolean(init1.reference), 'Authoritative transaction reference generated');
  assert(init1.payment.amountNaira === originalAmount, 'Payment record uses authoritative amount from server quote');
  assert(init1.isExisting === false, 'First call is not marked as existing');

  // Duplicate call with same idempotency key returns identical record
  const init2 = await PaymentService.initializePayment({
    repairJobId: job.id,
    customerId,
    idempotencyKey,
    paymentMethod: 'CARD',
    customerEmail: 'customer@test.fixhub.local',
  });

  assert(init2.success === true, 'Second call with identical idempotency key succeeds');
  if (!init2.success) return { passed, failed };
  assert(init2.isExisting === true, 'Duplicate call recognized as existing');
  assert(init2.payment.id === init1.payment.id, 'Returns exact same payment record without duplication');

  // Test 3: Verification & Held Funds State Machine
  console.log('\n3. Payment Verification & Held Funds Ledger');
  const verifyRes = await PaymentService.verifyPayment({
    reference: init1.reference,
    actorId: customerId,
    actorRole: 'customer',
  });

  assert(verifyRes.success === true, 'Payment verification succeeds');
  assert(verifyRes.payment?.status === 'SUCCESS', 'Payment status updated to SUCCESS');

  // Check ledger entry
  const earnings = db.technicianEarnings.find((e) => e.repairId === job.id);
  assert(Boolean(earnings), 'Technician earnings entry created in ledger');
  assert(earnings?.status === 'HELD', 'Earnings status is initially HELD pending repair completion');
  assert(earnings?.grossAmountNaira === originalAmount, 'Earnings gross amount matches authoritative payment');
  assert(earnings?.netEarningsNaira === calc.netEarningsNaira, 'Earnings net amount matches calculation');

  // Re-verification idempotency
  const verifyAgain = await PaymentService.verifyPayment({
    reference: init1.reference,
    actorId: customerId,
    actorRole: 'customer',
  });
  assert(verifyAgain.success === true && verifyAgain.alreadyVerified === true, 'Re-verification is safely idempotent');

  // Test 4: Financial Security & IDOR Verification
  console.log('\n4. Security Boundaries (IDOR & Tampering Guard)');
  const foreignCustomerId = 'usr_customer_2';
  const unauthVerify = await PaymentService.verifyPayment({
    reference: init1.reference,
    actorId: foreignCustomerId,
    actorRole: 'customer',
  });
  assert(unauthVerify.success === false, 'IDOR: Unauthorized customer cannot verify another customer’s payment');

  // Test 5: Held Funds Protection Against Premature Withdrawal
  console.log('\n5. Held Funds Protection (Cannot withdraw held repair earnings)');
  const techId = earnings!.technicianId;
  const prematurePayout = await PaymentService.requestPayout({
    technicianId: techId,
    amountNaira: earnings!.netEarningsNaira,
    actorId: techId,
  });

  assert(prematurePayout.success === false, 'Premature payout of held funds is strictly rejected');
  assert(prematurePayout.eligibleBalanceNaira === 0, 'Eligible balance remains 0 while job is in progress');

  // Test 6: Release of Funds upon Repair Completion
  console.log('\n6. Release of Funds upon Completion & Payout Eligibility');
  const releaseRes = PaymentService.releaseFundsOnCompletion(job.id, 'admin_system');
  assert(releaseRes.success === true, 'Technician funds successfully released on job completion');

  const updatedEarnings = db.technicianEarnings.find((e) => e.repairId === job.id);
  assert(updatedEarnings?.status === 'ELIGIBLE_FOR_PAYOUT', 'Earnings status transitioned to ELIGIBLE_FOR_PAYOUT');

  // Now payout request should succeed
  const validPayout = await PaymentService.requestPayout({
    technicianId: techId,
    amountNaira: Math.floor(updatedEarnings!.netEarningsNaira / 2),
    destinationAccount: {
      bankName: 'Guaranty Trust Bank',
      accountNumber: '0123456789',
      bankCode: '058',
      accountName: 'Authorized Tech',
    },
    actorId: techId,
  });

  assert(validPayout.success === true, 'Payout request succeeds when funds are eligible');
  assert(validPayout.payout?.amountNaira === Math.floor(updatedEarnings!.netEarningsNaira / 2), 'Payout amount matches request');

  // Verify remaining balance enforcement
  const excessivePayout = await PaymentService.requestPayout({
    technicianId: techId,
    amountNaira: updatedEarnings!.netEarningsNaira, // exceeds remaining balance
    actorId: techId,
  });
  assert(excessivePayout.success === false, 'Cannot request payout exceeding remaining balance after pending payout');

  // Test 7: Payout Security & Zero/Negative Protection
  console.log('\n7. Payout Security & Validation Guards');
  const foreignTechId = 'usr_tech_2';
  const unauthPayout = await PaymentService.requestPayout({
    technicianId: techId,
    amountNaira: 5000,
    actorId: foreignTechId,
  });
  assert(unauthPayout.success === false, 'Security: Technician cannot request payout for another technician’s balance');

  const zeroPayout = await PaymentService.requestPayout({
    technicianId: techId,
    amountNaira: 0,
    actorId: techId,
  });
  assert(zeroPayout.success === false, 'Validation: Zero payout request is rejected');

  // Verify missing bank account details rejection (Removal of demo fallback 058/0123456789)
  const noBankTechId = `tech_nobank_${Date.now()}`;
  db.technicianProfiles.push({
    id: `tp_${noBankTechId}`,
    userId: noBankTechId,
    businessName: 'No Bank Tech',
    bio: 'Test bio',
    location: { address: 'PH', city: 'Port Harcourt', state: 'Rivers', lga: 'Port Harcourt', latitude: 4.8, longitude: 7.0 },
    serviceRadiusKm: 10,
    specializations: ['Apple'],
    deviceTypesSupported: ['PHONE'],
    rating: 5,
    reviewsCount: 0,
    isVerified: true,
    verificationStatus: 'VERIFIED',
    joinedAt: new Date().toISOString(),
    completedRepairsCount: 0,
    activeRepairsCount: 0,
    badges: [],
    // bankDetails intentionally omitted!
  } as any);
  db.technicianEarnings.push({
    id: `te_${noBankTechId}`,
    technicianId: noBankTechId,
    repairId: `job_${noBankTechId}`,
    paymentId: `pay_${noBankTechId}`,
    grossAmountNaira: 20000,
    platformFeeNaira: 1700,
    netEarningsNaira: 18300,
    commissionPercent: 8.5,
    status: 'ELIGIBLE_FOR_PAYOUT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const missingBankPayout = await PaymentService.requestPayout({
    technicianId: noBankTechId,
    amountNaira: 5000,
    actorId: noBankTechId,
  });
  assert(missingBankPayout.success === false, 'Security: Payout rejected when technician has no registered bank account (demo fallback removed)');
  assert(missingBankPayout.error?.includes('bank details are missing or unverified'), 'Security: Clean error message returned when bank details missing');

  const invalidAccountPayout = await PaymentService.requestPayout({
    technicianId: noBankTechId,
    amountNaira: 5000,
    actorId: noBankTechId,
    destinationAccount: {
      accountNumber: '123', // invalid NUBAN
      bankCode: '058',
      bankName: 'GTB',
      accountName: 'Test',
    },
  });
  assert(invalidAccountPayout.success === false, 'Validation: Malformed NUBAN account number is rejected');

  // Test 8: Webhook Processing & Cryptographic Verification
  console.log('\n8. Webhook Processing & Signature Validation');
  const nowStr = new Date().toISOString();
  const testQuoteId = `quote_wh_${Date.now()}`;
  const testJobId = `job_wh_${Date.now()}`;
  db.repairQuotes.push({
    id: testQuoteId,
    requestId: 'req_demo_open',
    technicianId: 'usr_tech_1',
    technicianName: 'Emeka Fixes',
    businessName: 'Emeka Fixes Lab',
    technicianPhone: '08012345678',
    technicianRating: 4.9,
    technicianReviewsCount: 38,
    distanceKm: 2.1,
    partsCost: 20000,
    laborCost: 10000,
    diagnosticCost: 0,
    otherCost: 0,
    totalAmount: 30000,
    partsQuality: 'ORIGINAL_OEM',
    warrantyDays: 90,
    status: 'ACCEPTED',
    estimatedTimeHours: 2,
    notes: 'Screen repair webhook test',
    createdAt: nowStr,
  });

  const testJob = {
    id: testJobId,
    requestId: 'req_demo_open',
    quoteId: testQuoteId,
    customerId: 'usr_customer_1',
    technicianId: 'usr_tech_1',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['screen_damaged'],
    status: 'PAYMENT_PENDING' as const,
    dropOffCode: 'FX-9900',
    pickupCode: 'PK-9900',
    handoffQrToken: 'tok_wh_9900',
    originalQuoteAmount: 30000,
    finalAmount: 30000,
    platformFeeAmount: 2550,
    technicianPayoutAmount: 27450,
    partsUsed: [],
    createdAt: nowStr,
    statusHistory: [
      { status: 'PAYMENT_PENDING' as const, timestamp: nowStr, actorRole: 'customer' as const, note: 'Awaiting payment' }
    ],
  };
  db.repairJobs.push(testJob);

  const whInit = await PaymentService.initializePayment({
    repairJobId: testJob.id,
    customerId: testJob.customerId,
    idempotencyKey: `wh_test_init_${Date.now()}`,
    paymentMethod: 'CARD',
    customerEmail: 'customer@test.fixhub.local',
  });

  assert(whInit.success === true, 'Webhook test job payment initialized');
  if (!whInit.success) return { passed, failed };

  const mockWebhookPayload = {
    event: 'charge.success',
    data: {
      id: 998877,
      reference: whInit.reference,
      amount: whInit.payment.amountNaira * 100, // expected kobo
      currency: 'NGN',
      status: 'success',
      metadata: {
        repairJobId: testJob.id,
        customerId: testJob.customerId,
      },
    },
  };

  const rawBody = JSON.stringify(mockWebhookPayload);
  const validSignature = PaystackClient.generateHmacSignature(rawBody);

  // Invalid signature rejection
  const badSigRes = await PaymentService.processWebhook({
    rawBody,
    signatureHeader: 'invalid_fake_signature_hex',
    eventPayload: mockWebhookPayload,
  });
  assert(badSigRes.statusCode === 401, 'Webhook with forged/invalid HMAC signature is rejected (401)');

  // Valid signature acceptance
  const webhookRes = await PaymentService.processWebhook({
    rawBody,
    signatureHeader: validSignature,
    eventPayload: mockWebhookPayload,
  });

  assert(webhookRes.statusCode === 200, 'Webhook with valid HMAC signature returns 200 OK');
  assert(webhookRes.success === true, 'Webhook acknowledged as received and processed');

  // Verify webhook recorded in audit log
  const recordedWebhook = db.webhookEvents.find((w) => w.providerReference === whInit.reference);
  assert(Boolean(recordedWebhook), 'Webhook event recorded in database audit ledger');

  // Webhook duplicate idempotency
  const duplicateWebhookRes = await PaymentService.processWebhook({
    rawBody,
    signatureHeader: validSignature,
    eventPayload: mockWebhookPayload,
  });
  assert(duplicateWebhookRes.statusCode === 200, 'Duplicate webhook delivery returns 200 OK idempotently');

  // Test 9: Refund Integration Flow
  console.log('\n9. Refund Workflow via Paystack');
  const refundRes = await PaymentService.recordRefund({
    paymentId: whInit.payment.id,
    reason: 'Customer cancelled before device check-in',
    actorId: 'admin_1',
    actorRole: 'admin',
  });

  assert(refundRes.success === true, 'Refund successfully recorded and processed via Paystack');
  const refundedPayment = db.payments.find((p) => p.id === whInit.payment.id);
  assert(refundedPayment?.status === 'REFUNDED', 'Payment status updated to REFUNDED');

  const refundedJob = db.repairJobs.find((j) => j.id === testJob.id);
  assert(refundedJob?.status === 'REFUNDED' || refundedJob?.status === 'CANCELLED', 'Job status updated to REFUNDED upon refund');

  console.log(`\nPhase 5.1 Payment Suite Results: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPhase5PaymentTests()
    .then(({ failed }) => {
      if (failed > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}


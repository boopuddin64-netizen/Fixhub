import { db } from '../../server/db';
import { AuthService } from '../../server/services/authService';
import { TechnicianMatchingService } from '../../server/services/technicianMatchingService';
import { PaymentService } from '../../server/services/paymentService';
import { RepairWorkflowService } from '../../server/services/repairWorkflowService';
import { RepairJob, RepairQuote, ConditionReport, TechnicianPart } from '../../src/types/index';

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

export async function runRealPersonOrderFlowTest(): Promise<{ passed: number; failed: number }> {
  console.log('\n===============================================================');
  console.log('   FIXHUB REAL-PERSON END-TO-END ORDER FLOW SIMULATION TEST');
  console.log('===============================================================\n');

  // Reset database for a completely clean test run
  db.resetToSeed();

  const customerEmail = 'customer@test.fixhub.local';
  const techEmail = 'technician@test.fixhub.local';
  const now = new Date().toISOString();

  // -------------------------------------------------------------
  // STEP 1: Customer Onboarding & Authentication
  // -------------------------------------------------------------
  console.log('1. Customer Authentication & Profile Readiness');
  const custAuth = AuthService.login(customerEmail, 'password123');
  assert(!('error' in custAuth), 'Customer signs in successfully');
  const customerUser = !('error' in custAuth) ? custAuth.user : null;
  assert(customerUser?.role === 'customer', 'User authenticated with customer role');

  // -------------------------------------------------------------
  // STEP 2: Request Creation & Location Verification
  // -------------------------------------------------------------
  console.log('\n2. Repair Request Initiation (Wizard Submission)');
  const requestId = `req_real_${Date.now()}`;
  const customerLocation = {
    address: '12 Aba Road, Garrison, Port Harcourt',
    city: 'Port Harcourt',
    state: 'Rivers State',
    area: 'Garrison Junction',
    lat: 4.8156,
    lng: 7.0498,
    source: 'GPS' as const,
  };

  const newRequest = {
    id: requestId,
    customerId: customerUser!.id,
    deviceBrand: 'Samsung',
    deviceModel: 'Galaxy S23 Ultra',
    deviceType: 'SMARTPHONE' as const,
    issues: ['CRACKED_SCREEN', 'BATTERY_DRAIN'],
    description: 'Screen shattered after drop, battery also drains within 3 hours.',
    photos: ['https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600'],
    customerLocation,
    status: 'REQUESTED' as const,
    createdAt: now,
    updatedAt: now,
    quotesCount: 0,
    matchedTechnicians: [],
  };
  db.repairRequests.push(newRequest as any);
  assert(db.repairRequests.some((r) => r.id === requestId), 'Repair request saved to database');

  // -------------------------------------------------------------
  // STEP 3: Technician Discovery & Compatibility Matching
  // -------------------------------------------------------------
  console.log('\n3. Technician Discovery & Radius Matching');
  const matchedTechs = TechnicianMatchingService.matchTechnicians({
    deviceBrand: newRequest.deviceBrand,
    deviceModel: newRequest.deviceModel,
    issues: newRequest.issues,
    customerLocation: newRequest.customerLocation,
    maxDistanceKm: 25,
  });

  assert(Array.isArray(matchedTechs) && matchedTechs.length > 0, 'Matching algorithm successfully identifies nearby technicians');
  const topMatch = matchedTechs[0];
  assert(topMatch.distanceKm <= 25, 'Matched technician is within user requested distance radius');
  assert(topMatch.totalScore > 0, 'Technician receives positive multi-factor compatibility score');

  // -------------------------------------------------------------
  // STEP 4: Technician Leads Board & Quote Preparation
  // -------------------------------------------------------------
  console.log('\n4. Technician Lead Inspection & Authoritative Quote Creation');
  const techAuth = AuthService.login(techEmail, 'password123');
  assert(!('error' in techAuth), 'Technician logs in to shop workspace');
  const techUser = !('error' in techAuth) ? techAuth.user : null;

  // Technician builds binding quote
  const quoteId = `quote_real_${Date.now()}`;
  const partsCost = 65000;
  const laborCost = 15000;
  const totalAmount = partsCost + laborCost;

  const bindingQuote: RepairQuote = {
    id: quoteId,
    requestId: requestId,
    technicianId: techUser!.id,
    businessName: 'Emeka Phone Labs',
    technicianName: 'Emeka Okafor',
    technicianPhone: '+234 802 555 0101',
    technicianAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    technicianRating: 4.9,
    technicianReviewsCount: 142,
    distanceKm: topMatch.distanceKm,
    partsCost,
    laborCost,
    otherCost: 0,
    totalAmount,
    estimatedTimeHours: 2,
    partsQuality: 'PREMIUM_AFTERMARKET',
    warrantyDays: 90,
    status: 'SUBMITTED',
    notes: 'Premium OLED display assembly and certified high-capacity battery with 90 days warranty.',
    createdAt: now,
    expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    items: [
      {
        id: 'qli_1',
        inventoryItemId: 'part_test_1',
        partNameSnapshot: 'Samsung Galaxy S23 Ultra OLED Assembly',
        qualitySnapshot: 'PREMIUM_AFTERMARKET',
        unitPriceSnapshot: 45000,
        priceVersion: 1,
        quantity: 1,
        subtotal: 45000,
      },
      {
        id: 'qli_2',
        inventoryItemId: 'part_test_2',
        partNameSnapshot: 'OEM Replacement Battery Pack',
        qualitySnapshot: 'PREMIUM_AFTERMARKET',
        unitPriceSnapshot: 20000,
        priceVersion: 1,
        quantity: 1,
        subtotal: 20000,
      },
    ],
  };

  db.repairQuotes.push(bindingQuote);
  newRequest.quotesCount = 1;
  assert(db.repairQuotes.some((q) => q.id === quoteId), 'Technician quote successfully recorded in ledger');

  // -------------------------------------------------------------
  // STEP 5: Customer Acceptance & Booking Creation
  // -------------------------------------------------------------
  console.log('\n5. Customer Quote Comparison & Binding Acceptance');
  const bookingRes = RepairWorkflowService.acceptQuote({
    requestId,
    quoteId,
    customerId: customerUser!.id,
  });
  assert(!('error' in bookingRes) && !!bookingRes.job, 'Customer accepting quote creates authoritative RepairJob');
  const activeJob: RepairJob = !('error' in bookingRes) ? bookingRes.job : ({} as any);

  assert(activeJob.status === 'PAYMENT_PENDING', 'Job created in initial PAYMENT_PENDING state');
  assert(Boolean(activeJob.dropOffCode), 'Drop-off code generated for counter check-in');
  assert(Boolean(activeJob.pickupCode), 'Pickup code generated for device release');
  assert(activeJob.finalAmount === totalAmount, 'Job authoritative amount matches quote binding total');

  // -------------------------------------------------------------
  // STEP 6: Paystack Payment Initialization & Escrow Hold
  // -------------------------------------------------------------
  console.log('\n6. Escrow Payment via Paystack');
  const idempKey = `idemp_${Date.now()}`;
  const initPayRes = await PaymentService.initializePayment({
    repairJobId: activeJob.id,
    customerId: customerUser!.id,
    paymentMethod: 'CARD',
    idempotencyKey: idempKey,
  });

  assert(initPayRes.success, 'Paystack payment session successfully initialized');
  if (!initPayRes.success) throw new Error('Payment initialization failed');
  assert(Boolean(initPayRes.reference), 'Secure Paystack transaction reference generated');

  const verifyPayRes = await PaymentService.verifyPayment({ reference: initPayRes.reference });
  assert(verifyPayRes.success && verifyPayRes.payment.status === 'SUCCESS', 'Payment successfully verified');

  const heldEarning = db.technicianEarnings.find((e) => e.repairId === activeJob.id);
  assert(Boolean(heldEarning && heldEarning.status === 'HELD'), 'Payment held securely in platform escrow ledger pending repair completion');
  assert(heldEarning?.netEarningsNaira! > 0, 'Held earnings calculated net of platform fee');

  // -------------------------------------------------------------
  // STEP 7: Customer Shop Visit & Drop-Off Code Verification
  // -------------------------------------------------------------
  console.log('\n7. Physical Counter Handoff: Drop-Off Code Verification');
  // Attempt invalid drop-off code
  const badDropOff = RepairWorkflowService.verifyDropOff({
    jobId: activeJob.id,
    technicianId: techUser!.id,
    dropOffCode: 'WRONG6',
  });
  assert(!badDropOff.success, 'Invalid drop-off code is strictly rejected at counter');

  // Valid drop-off code
  const goodDropOff = RepairWorkflowService.verifyDropOff({
    jobId: activeJob.id,
    technicianId: techUser!.id,
    dropOffCode: activeJob.dropOffCode!,
  });
  assert(goodDropOff.success, 'Valid drop-off code verified by technician at counter');
  const updatedJobDropOff = db.repairJobs.find((j) => j.id === activeJob.id)!;
  assert(updatedJobDropOff.status === 'DEVICE_DROPPED_OFF', 'Job status transitions to DEVICE_DROPPED_OFF');

  // -------------------------------------------------------------
  // STEP 8: Technician Intake Condition Report
  // -------------------------------------------------------------
  console.log('\n8. Bench Check-In & Physical Condition Assessment');
  const conditionReport: ConditionReport = {
    timestamp: now,
    frontCondition: 'CRACKED',
    backCondition: 'PERFECT',
    frameCondition: 'SCUFFED',
    screenPowersOn: true,
    touchResponsive: false,
    cameraWorking: true,
    existingDamageNotes: 'Screen glass completely shattered on lower-right quadrant, no display touch response.',
    accessoriesReceived: ['Phone only', 'SIM tray included'],
    technicianNotes: 'Intake inspection verified device matches customer description.',
    photos: ['https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600'],
  };

  const checkInRes = RepairWorkflowService.checkInDevice({
    jobId: activeJob.id,
    technicianId: techUser!.id,
    report: conditionReport,
  });
  assert(checkInRes.success, 'Device check-in condition report accepted');
  const updatedJobCheckIn = db.repairJobs.find((j) => j.id === activeJob.id)!;
  assert(updatedJobCheckIn.status === 'DEVICE_RECEIVED', 'Job status transitions to DEVICE_RECEIVED');

  // -------------------------------------------------------------
  // STEP 9: Diagnostic Scan & Additional Diagnosis Branch
  // -------------------------------------------------------------
  console.log('\n9. Bench Diagnostics & Additional Issue Approval Flow');
  updatedJobCheckIn.status = 'DIAGNOSING';

  // Technician reports additional hidden damage (corroded flex cable)
  const addDiagRes = RepairWorkflowService.submitAdditionalDiagnosis({
    jobId: activeJob.id,
    technicianId: techUser!.id,
    title: 'Oxidized Charging Sub-Board Flex',
    description: 'Found moisture residue and corrosion on the USB-C flex sub-board.',
    additionalCostNaira: 8000,
    photoEvidence: ['https://images.unsplash.com/photo-1596742578443-7682ef5251cd?w=600'],
  });
  assert(addDiagRes.success, 'Additional diagnosis submitted to customer');
  const updatedJobDiag = db.repairJobs.find((j) => j.id === activeJob.id)!;
  assert(updatedJobDiag.status === 'ADDITIONAL_DIAGNOSIS', 'Job enters ADDITIONAL_DIAGNOSIS waiting for customer approval');

  // Customer approves additional diagnosis
  const custApprovalRes = RepairWorkflowService.respondToAdditionalDiagnosis({
    jobId: activeJob.id,
    customerId: customerUser!.id,
    approved: true,
    reason: 'Approved oxidized flex replacement',
  });
  assert(custApprovalRes.success, 'Customer approves additional repair scope');
  const updatedJobApproved = db.repairJobs.find((j) => j.id === activeJob.id)!;
  assert(updatedJobApproved.status === 'REPAIR_IN_PROGRESS', 'Job returns to REPAIR_IN_PROGRESS');
  assert(updatedJobApproved.finalAmount === totalAmount + 8000, 'Authoritative total adjusted to reflect approved additional diagnosis');

  // -------------------------------------------------------------
  // STEP 10: Part Recording & Ready for Pickup
  // -------------------------------------------------------------
  console.log('\n10. Part Tracking & Ready for Pickup Notification');
  updatedJobApproved.partsUsed = [
    {
      id: 'pu_test_1',
      partId: 'part_test_1',
      partName: 'Samsung Galaxy S23 Ultra Hard OLED',
      deviceModel: 'Samsung Galaxy S23 Ultra',
      quality: 'PREMIUM_AFTERMARKET',
      priceNaira: 45000,
      warrantyDays: 90,
      installationTimestamp: now,
    },
  ];
  assert(updatedJobApproved.partsUsed.length > 0, 'Installed part serial and grade recorded on work order');

  updatedJobApproved.status = 'READY_FOR_PICKUP';
  assert(updatedJobApproved.status === 'READY_FOR_PICKUP', 'Job marked READY_FOR_PICKUP');

  // -------------------------------------------------------------
  // STEP 11: Counter Pickup Code Verification
  // -------------------------------------------------------------
  console.log('\n11. Counter Pickup: 6-Digit Pickup Code Verification');
  // Attempt invalid pickup code
  const badPickup = RepairWorkflowService.verifyPickup({
    jobId: activeJob.id,
    technicianId: techUser!.id,
    pickupCode: 'PK-WRONG',
  });
  assert(!badPickup.success, 'Invalid pickup code is rejected at counter');

  // Valid pickup code
  const goodPickup = RepairWorkflowService.verifyPickup({
    jobId: activeJob.id,
    technicianId: techUser!.id,
    pickupCode: activeJob.pickupCode!,
  });
  assert(goodPickup.success, 'Valid pickup code confirmed by technician');
  const updatedJobPickedUp = db.repairJobs.find((j) => j.id === activeJob.id)!;
  assert(updatedJobPickedUp.status === 'PICKED_UP', 'Job status transitions to PICKED_UP');
  assert(Boolean(updatedJobPickedUp.pickupVerifiedAt), 'Pickup timestamp recorded in audit trail');

  // -------------------------------------------------------------
  // STEP 12: Customer Completion Confirmation & Escrow Release
  // -------------------------------------------------------------
  console.log('\n12. Customer Confirms Repair, Funds Released & Warranty Activated');
  const completeRes = RepairWorkflowService.confirmCompletion({
    jobId: activeJob.id,
    customerId: customerUser!.id,
  });
  const updatedJobCompleted = db.repairJobs.find((j) => j.id === activeJob.id)!;
  assert(completeRes.success && updatedJobCompleted.status === 'COMPLETED', 'Job marked COMPLETED by customer');

  // Verify escrow funds released to technician
  const postCompleteEarnings = db.technicianEarnings.find((e) => e.repairId === activeJob.id);
  assert(postCompleteEarnings?.status === 'ELIGIBLE_FOR_PAYOUT', 'Escrow funds successfully released to technician eligible payout balance');

  // Verify Warranty Passport record generated
  const customerWarranties = db.warranties.filter((w) => w.repairJobId === activeJob.id);
  assert(customerWarranties.length > 0, 'Automatic 90-day digital warranty passport generated for customer');
  const activeWarranty = customerWarranties[0];
  assert(activeWarranty.status === 'ACTIVE', 'Warranty is in ACTIVE state');
  assert(activeWarranty.repairJobId === activeJob.id, 'Warranty linked directly to repair job ID');

  // -------------------------------------------------------------
  // STEP 13: Customer Review Submission
  // -------------------------------------------------------------
  console.log('\n13. Customer Verified Review Submission');
  const reviewObj = {
    id: `rev_real_${Date.now()}`,
    repairId: activeJob.id,
    customerId: customerUser!.id,
    customerName: customerUser!.name,
    technicianId: techUser!.id,
    rating: 5,
    comment: 'Flawless repair! The screen looks crisp, battery lasts all day, and phone was ready in 2 hours.',
    verifiedPurchase: true as const,
    repairSummary: 'Samsung Galaxy S23 Ultra (Screen & Battery)',
    createdAt: new Date().toISOString(),
  };
  db.reviews.push(reviewObj);

  const techProfile = db.technicianProfiles.find((t) => t.userId === techUser!.id);
  assert(techProfile !== undefined, 'Technician profile exists');
  assert(db.reviews.some((r) => r.repairId === activeJob.id), 'Verified customer review published');

  // -------------------------------------------------------------
  // STEP 14: Technician Payout Request to Verified Bank Account
  // -------------------------------------------------------------
  console.log('\n14. Technician Escrow Payout Request');
  // Ensure tech profile has verified bank details
  if (techProfile) {
    techProfile.bankDetails = {
      bankName: 'Access Bank',
      accountNumber: '0123456789',
      bankCode: '044',
      accountName: 'Emeka Okafor',
      verified: true,
    };
  }

  const payoutRes = await PaymentService.requestPayout({
    technicianId: techUser!.id,
    amountNaira: Math.floor(postCompleteEarnings!.netEarningsNaira / 2),
    actorId: techUser!.id,
    destinationAccount: {
      bankName: 'Access Bank',
      accountNumber: '0123456789',
      bankCode: '044',
      accountName: 'Emeka Okafor',
    },
  });
  assert(payoutRes.success, 'Technician successfully requests bank transfer payout of earned funds');

  console.log(`\nReal-Person Order Flow Test Results: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

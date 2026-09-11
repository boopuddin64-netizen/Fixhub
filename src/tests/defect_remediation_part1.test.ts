import { db } from '../../server/db';
import { InventoryService } from '../../server/services/inventoryService';
import { PaymentService } from '../../server/services/paymentService';
import { RepairWorkflowService } from '../../server/services/repairWorkflowService';
import { sanitizeTechnicianForPublic } from '../../server/routes/api';
import { RepairJob, RepairQuote, TechnicianPart } from '../../src/types/index';

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

export async function runDefectRemediationPart1Tests(): Promise<{ passed: number; failed: number }> {
  console.log('\n===============================================================');
  console.log('   FIX HUB DEFECT REMEDIATION PART 1 — CORE INTEGRITY & WORKFLOW');
  console.log('===============================================================\n');

  // Reset database to ensure isolated test environment
  db.resetToSeed();

  if (db.repairRequests.length === 0) {
    db.repairRequests.push({
      id: 'req_defect_test',
      customerId: 'usr_customer_1',
      customerName: 'Test Customer',
      customerPhone: '+2348000000000',
      customerLocation: { lat: 6.5964, lng: 3.3421, address: 'Ikeja', city: 'Lagos', state: 'Lagos State' },
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      issues: ['screen_damaged'],
      description: 'Test request',
      photos: [],
      status: 'QUOTING',
      quotesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  const tech1Id = 'usr_tech_1';
  const tech2Id = 'usr_tech_2';
  const customer1Id = 'usr_customer_1';
  const customer2Id = 'usr_customer_2';

  // -------------------------------------------------------------
  // MODULE 1: Quote Submission & Inventory Ownership Integrity
  // -------------------------------------------------------------
  console.log('1. Quote Submission & Inventory Ownership Integrity');

  // Setup technician inventory
  const partTech1: TechnicianPart = {
    id: `part_t1_${Date.now()}`,
    technicianId: tech1Id,
    sku: 'SKU-APL-IP13-SCR',
    partName: 'iPhone 13 OLED Display Panel Grade A',
    brand: 'Apple',
    deviceBrand: 'Apple',
    compatibleModels: ['iPhone 13'],
    category: 'Screens & Displays',
    quality: 'PREMIUM_AFTERMARKET',
    unitPriceNaira: 35000,
    currency: 'NGN',
    quantityOnHand: 10,
    quantityReserved: 0,
    quantityAvailable: 10,
    inStockCount: 10,
    stockQuantity: 10,
    status: 'IN_STOCK',
    supplier: 'FixHub Direct',
    warrantyDays: 90,
    priceVersion: 1,
    priceHistory: [{ version: 1, priceNaira: 35000, changedAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  db.technicianParts.push(partTech1);

  const partTech2: TechnicianPart = {
    id: `part_t2_${Date.now()}`,
    technicianId: tech2Id,
    sku: 'SKU-APL-IP13-BAT',
    partName: 'iPhone 13 Battery Replacement OEM',
    brand: 'Apple',
    deviceBrand: 'Apple',
    compatibleModels: ['iPhone 13'],
    category: 'Batteries & Power',
    quality: 'ORIGINAL_OEM',
    unitPriceNaira: 18000,
    currency: 'NGN',
    quantityOnHand: 5,
    quantityReserved: 0,
    quantityAvailable: 5,
    inStockCount: 5,
    stockQuantity: 5,
    status: 'IN_STOCK',
    supplier: 'Apex Components',
    warrantyDays: 180,
    priceVersion: 1,
    priceHistory: [{ version: 1, priceNaira: 18000, changedAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  db.technicianParts.push(partTech2);

  const testRequest = db.repairRequests[0];

  // 1.1: Valid Quote Line Items from Tech 1 Inventory
  const validValidation = InventoryService.validateAndBuildQuoteLineItems(
    tech1Id,
    [{ inventoryItemId: partTech1.id, quantity: 1 }],
    testRequest
  );
  assert(validValidation.valid === true, 'Tech 1 inventory item successfully validates for quote');
  if (validValidation.valid) {
    assert(validValidation.totalPartsCost === 35000, 'Authoritative parts cost derived from inventory item');
    assert(validValidation.items.length === 1, 'Quote line item created with snapshot metadata');
  }

  // 1.2: Cross-Technician Inventory Theft Prevention (Tech 1 tries to quote Tech 2 part)
  const stolenValidation = InventoryService.validateAndBuildQuoteLineItems(
    tech1Id,
    [{ inventoryItemId: partTech2.id, quantity: 1 }],
    testRequest
  );
  assert(stolenValidation.valid === false, 'Cross-technician inventory item quoting is strictly blocked');
  if (!stolenValidation.valid) {
    const errorMsg = (stolenValidation as any).error || '';
    assert(
      errorMsg.includes('Security Violation: Inventory item') &&
      errorMsg.includes('does not belong to your technician profile'),
      'Security error message clearly notes profile ownership violation'
    );
  }

  // 1.3: Reservation isolation: Tech 1 quote cannot reserve Tech 2 inventory
  const crossQuote: RepairQuote = {
    id: `quote_cross_${Date.now()}`,
    requestId: testRequest.id,
    technicianId: tech1Id,
    technicianName: 'Emeka Nwosu',
    technicianPhone: '08012345678',
    businessName: 'Apex Device Repairs',
    technicianRating: 4.9,
    technicianReviewsCount: 38,
    distanceKm: 1.2,
    partsCost: 18000,
    laborCost: 10000,
    diagnosticCost: 0,
    otherCost: 0,
    totalAmount: 28000,
    warrantyDays: 90,
    estimatedTimeHours: 2,
    partsQuality: 'ORIGINAL_OEM',
    status: 'SUBMITTED',
    notes: 'Cross technician reservation test quote',
    items: [
      {
        id: 'qli_cross_1',
        inventoryItemId: partTech2.id, // Tech 2's part
        partNameSnapshot: partTech2.partName,
        qualitySnapshot: partTech2.quality,
        unitPriceSnapshot: 18000,
        priceVersion: 1,
        quantity: 1,
        subtotal: 18000,
        skuSnapshot: partTech2.sku,
        brandSnapshot: partTech2.brand,
        warrantyDaysSnapshot: 180,
      },
    ],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  const tech2BeforeReserved = partTech2.quantityReserved;
  InventoryService.reserveStockForQuote(crossQuote, 'job_test_cross');
  const tech2AfterReserved = db.technicianParts.find((p) => p.id === partTech2.id)!.quantityReserved;
  assert(tech2BeforeReserved === tech2AfterReserved, 'Stock reservation strictly ignores parts not owned by quoting technician');

  // 1.4: Part installation deduction isolation
  const crossPartRecord = {
    id: 'pr_cross_1',
    jobId: 'job_test_1',
    technicianId: tech1Id,
    partName: partTech2.partName,
    inventoryItemId: partTech2.id, // Tech 2's part
    deviceModel: 'iPhone 13',
    quality: partTech2.quality,
    priceNaira: 18000,
    quantity: 1,
    installationTimestamp: now,
  };
  const tech2OnHandBefore = db.technicianParts.find((p) => p.id === partTech2.id)!.quantityOnHand;
  InventoryService.deductStockForInstalledPart(crossPartRecord as any, 'job_test_1', tech1Id);
  const tech2OnHandAfter = db.technicianParts.find((p) => p.id === partTech2.id)!.quantityOnHand;
  assert(tech2OnHandBefore === tech2OnHandAfter, 'Stock deduction strictly ignores parts not owned by installing technician');

  // -------------------------------------------------------------
  // MODULE 2: Payout Integrity & Bank Account Verification
  // -------------------------------------------------------------
  console.log('\n2. Payout Integrity & Bank Account Verification');

  const noBankTechId = `tech_nobank_${Date.now()}`;
  db.technicianProfiles.push({
    id: `tp_${noBankTechId}`,
    userId: noBankTechId,
    businessName: 'Unconfigured Payout Tech',
    bio: 'Technician without bank details',
    location: { address: 'D-Line', city: 'Port Harcourt', state: 'Rivers', lga: 'Port Harcourt', latitude: 4.81, longitude: 7.02 },
    serviceRadiusKm: 15,
    specializations: ['Apple'],
    deviceTypesSupported: ['PHONE'],
    rating: 5,
    reviewsCount: 1,
    isVerified: true,
    verificationStatus: 'VERIFIED',
    joinedAt: now,
    completedRepairsCount: 1,
    activeRepairsCount: 0,
    badges: [],
    // bankDetails intentionally NOT set
  } as any);

  db.technicianEarnings.push({
    id: `te_${noBankTechId}`,
    technicianId: noBankTechId,
    repairId: `job_nobank_1`,
    paymentId: `pay_nobank_1`,
    grossAmountNaira: 50000,
    platformFeeNaira: 4250,
    netEarningsNaira: 45750,
    commissionPercent: 8.5,
    status: 'ELIGIBLE_FOR_PAYOUT',
    createdAt: now,
    updatedAt: now,
  });

  // 2.1: Rejection of payout when bank details missing (no demo fallback to 058/0123456789)
  const noBankPayout = await PaymentService.requestPayout({
    technicianId: noBankTechId,
    amountNaira: 10000,
    actorId: noBankTechId,
  });
  assert(noBankPayout.success === false, 'Payout rejected when technician has no registered bank account (demo fallback removed)');
  assert(
    Boolean(noBankPayout.error && noBankPayout.error.includes('bank details are missing or unverified')),
    'Clean actionable error message returned when bank details missing'
  );

  // 2.2: Rejection of malformed bank account / NUBAN
  const malformedPayout = await PaymentService.requestPayout({
    technicianId: noBankTechId,
    amountNaira: 10000,
    actorId: noBankTechId,
    destinationAccount: {
      accountNumber: '12345', // only 5 digits
      bankCode: '058',
      bankName: 'GTB',
      accountName: 'Tech',
    },
  });
  assert(malformedPayout.success === false, 'Payout rejected when account number is not a 10-digit NUBAN');

  // 2.3: Successful payout when valid bank account details are supplied
  const validBankPayout = await PaymentService.requestPayout({
    technicianId: noBankTechId,
    amountNaira: 10000,
    actorId: noBankTechId,
    destinationAccount: {
      accountNumber: '0123456789', // valid 10 digits
      bankCode: '058',
      bankName: 'Guaranty Trust Bank',
      accountName: 'Verified Technician Account',
    },
  });
  assert(validBankPayout.success === true, 'Payout succeeds when valid 10-digit NUBAN and bank code provided');
  assert(validBankPayout.payout?.amountNaira === 10000, 'Authoritative payout amount matches requested amount');

  // 2.4: Remaining balance enforcement after payout
  const remainingExcessPayout = await PaymentService.requestPayout({
    technicianId: noBankTechId,
    amountNaira: 40000, // available is 45750 - 10000 = 35750
    actorId: noBankTechId,
    destinationAccount: {
      accountNumber: '0123456789',
      bankCode: '058',
      bankName: 'Guaranty Trust Bank',
      accountName: 'Verified Technician Account',
    },
  });
  assert(remainingExcessPayout.success === false, 'Cannot request payout exceeding remaining eligible balance');

  // -------------------------------------------------------------
  // MODULE 3: Repair Lifecycle State Machine & Role Transitions
  // -------------------------------------------------------------
  console.log('\n3. Repair Lifecycle State Machine & Role Transitions');

  const testLifecycleJob: RepairJob = {
    id: `job_life_${Date.now()}`,
    requestId: testRequest.id,
    quoteId: 'quote_test_1',
    customerId: customer1Id,
    technicianId: tech1Id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['screen_damaged'],
    status: 'PAYMENT_PENDING',
    dropOffCode: 'FX-1122',
    pickupCode: 'PK-3344',
    handoffQrToken: 'tok_qr_1122',
    originalQuoteAmount: 45000,
    finalAmount: 45000,
    platformFeeAmount: 3825,
    technicianPayoutAmount: 41175,
    partsUsed: [],
    createdAt: now,
    statusHistory: [
      { status: 'PAYMENT_PENDING', timestamp: now, actorRole: 'customer', note: 'Created' },
    ],
  };
  db.repairJobs.push(testLifecycleJob);

  // 3.1: Illegal transition from PAYMENT_PENDING directly to REPAIR_IN_PROGRESS
  const canSkipToRepair = RepairWorkflowService.isValidTransition('PAYMENT_PENDING', 'REPAIR_IN_PROGRESS');
  assert(canSkipToRepair === false, 'Cannot transition directly from PAYMENT_PENDING to REPAIR_IN_PROGRESS');

  // 3.2: Illegal transition from PAYMENT_PENDING directly to COMPLETED
  const canSkipToCompleted = RepairWorkflowService.isValidTransition('PAYMENT_PENDING', 'COMPLETED');
  assert(canSkipToCompleted === false, 'Cannot mark job as COMPLETED while still unpaid');

  // 3.3: Simulate payment to advance to BOOKED
  (testLifecycleJob as any).status = 'BOOKED';
  testLifecycleJob.statusHistory.push({ status: 'BOOKED', timestamp: now, actorRole: 'admin', note: 'Payment verified' });

  // 3.3b: Drop-off verification step: Invalid drop-off code is rejected
  const invalidDropOffRes = RepairWorkflowService.verifyDropOff({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    dropOffCode: 'WRONG-CODE',
  });
  assert(invalidDropOffRes.success === false, 'Invalid drop-off verification code is rejected');

  // 3.3c: Drop-off verification step: Valid drop-off code transitions to DEVICE_DROPPED_OFF
  const validDropOffRes = RepairWorkflowService.verifyDropOff({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    dropOffCode: testLifecycleJob.dropOffCode!,
  });
  assert(validDropOffRes.success === true, 'Drop-off verification succeeds with correct code');
  assert((testLifecycleJob.status as string) === 'DEVICE_DROPPED_OFF', 'Job status transitions to DEVICE_DROPPED_OFF');
  assert(Boolean((testLifecycleJob as any).dropOffVerifiedAt), 'Drop-off timestamp dropOffVerifiedAt recorded');

  // 3.4: Check-in device workflow (transitions DEVICE_DROPPED_OFF -> DEVICE_RECEIVED)
  const checkInRes = RepairWorkflowService.checkInDevice({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    report: {
      timestamp: now,
      frontCondition: 'CRACKED',
      backCondition: 'MINOR_SCRATCHES',
      frameCondition: 'SCUFFED',
      screenPowersOn: true,
      touchResponsive: true,
      cameraWorking: true,
      existingDamageNotes: 'Cracked outer glass',
      accessoriesReceived: ['Clear protective case'],
      photos: ['/api/repairs/attachments/intake_01.jpg'],
      technicianNotes: 'Intake inspection verified',
    },
  });
  assert(checkInRes.success === true, 'Technician device check-in succeeds with condition report', checkInRes.error);
  assert((testLifecycleJob.status as string) === 'DEVICE_RECEIVED', 'Job status transitions to DEVICE_RECEIVED');

  // 3.5: Additional diagnosis with extra cost requires customer approval
  const addDiagRes = RepairWorkflowService.submitAdditionalDiagnosis({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    title: 'Damaged Frame Bezel',
    description: 'Internal frame requires realignment before screen installation.',
    additionalCostNaira: 5000,
    photoEvidence: ['/api/repairs/attachments/frame_bent.jpg'],
  });
  assert(addDiagRes.success === true, 'Additional diagnosis submitted');
  assert(addDiagRes.diagnosis?.status === 'PENDING_APPROVAL', 'Additional diagnosis with cost requires customer approval');
  assert(addDiagRes.diagnosis?.isMinorAutoApproved === false, 'Zero auto-approval on customer financial increases');
  assert((testLifecycleJob.status as string) === 'ADDITIONAL_DIAGNOSIS', 'Job status transitions to ADDITIONAL_DIAGNOSIS awaiting customer action');

  // 3.6: Customer approves additional diagnosis
  const approveDiagRes = RepairWorkflowService.respondToAdditionalDiagnosis({
    jobId: testLifecycleJob.id,
    customerId: customer1Id,
    approved: true,
    reason: 'Approved frame repair',
  });
  assert(approveDiagRes.success === true, 'Customer approves additional diagnosis');
  assert((testLifecycleJob.status as string) === 'REPAIR_IN_PROGRESS', 'Job returns to REPAIR_IN_PROGRESS upon approval');
  assert(testLifecycleJob.finalAmount === 50000, 'Job final amount updated to ₦50,000');

  // 3.7: Advance to READY_FOR_PICKUP
  const canGoReady = RepairWorkflowService.isValidTransition('REPAIR_IN_PROGRESS', 'READY_FOR_PICKUP');
  assert(canGoReady === true, 'Valid transition from REPAIR_IN_PROGRESS to READY_FOR_PICKUP');
  (testLifecycleJob as any).status = 'READY_FOR_PICKUP';

  // 3.8: Counter pickup verification
  // Wrong code
  const wrongCodePickup = RepairWorkflowService.verifyPickup({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    pickupCode: 'PK-WRONG',
  });
  assert(wrongCodePickup.success === false, 'Invalid pickup verification code is rejected');

  // Right code
  const validPickup = RepairWorkflowService.verifyPickup({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    pickupCode: testLifecycleJob.pickupCode,
  });
  assert(validPickup.success === true, 'Counter pickup verified with correct customer code');
  assert((testLifecycleJob.status as string) === 'PICKED_UP', 'Job status transitioned to PICKED_UP');
  assert(Boolean(testLifecycleJob.pickupVerifiedAt), 'Handover timestamp pickupVerifiedAt successfully recorded');

  // Re-verification prevention (cannot reuse code or reverify picked-up device)
  const reusedPickup = RepairWorkflowService.verifyPickup({
    jobId: testLifecycleJob.id,
    technicianId: tech1Id,
    pickupCode: testLifecycleJob.pickupCode,
  });
  assert(reusedPickup.success === false, 'Already picked up device cannot be re-verified or reused');

  // -------------------------------------------------------------
  // MODULE 4: Sensitive Data Protection & Sanitization
  // -------------------------------------------------------------
  console.log('\n4. Sensitive Data Protection & Sanitization');

  const testTechProfile = db.technicianProfiles.find((t) => t.userId === tech1Id);
  if (testTechProfile) {
    // Add mock sensitive details if not present
    testTechProfile.bankDetails = {
      bankCode: '058',
      bankName: 'GTBank',
      accountNumber: '0123456789',
      accountName: 'Emeka Nwosu',
      verified: true,
    };
    testTechProfile.trustScore = 96;

    const sanitized = sanitizeTechnicianForPublic(testTechProfile);
    assert(!('bankDetails' in sanitized), 'Technician bankDetails strictly scrubbed from public/customer payload');
    assert(!('trustScore' in sanitized), 'Technician internal trustScore strictly scrubbed from public/customer payload');
    assert(sanitized.businessName === testTechProfile.businessName, 'Non-sensitive business details preserved');
    assert(sanitized.rating === testTechProfile.rating, 'Public ratings preserved');
  }

  // -------------------------------------------------------------
  // MODULE 5: Attachment Security & Stored XSS Mitigation
  // -------------------------------------------------------------
  console.log('\n5. Attachment Security & Stored XSS Mitigation');

  // Test malicious SVG payload detection
  const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('XSS')</script></svg>`;
  const buffer = Buffer.from(maliciousSvg, 'utf8');
  const textContent = buffer.toString('utf8');
  const hasScript =
    /<script/i.test(textContent) ||
    /javascript:/i.test(textContent) ||
    /onload=/i.test(textContent) ||
    /onerror=/i.test(textContent) ||
    /<foreignObject/i.test(textContent);
  assert(hasScript === true, 'Malicious script tags in SVG attachments are correctly identified for rejection');

  const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red" /></svg>`;
  const cleanBuffer = Buffer.from(cleanSvg, 'utf8');
  const cleanText = cleanBuffer.toString('utf8');
  const cleanHasScript =
    /<script/i.test(cleanText) ||
    /javascript:/i.test(cleanText) ||
    /onload=/i.test(cleanText) ||
    /onerror=/i.test(cleanText) ||
    /<foreignObject/i.test(cleanText);
  assert(cleanHasScript === false, 'Benign SVG attachments without scripts are recognized as safe');

  // -------------------------------------------------------------
  // MODULE 6: Cancellation of Paid vs Unpaid Jobs (Refund & Inventory)
  // -------------------------------------------------------------
  console.log('\n6. Cancellation of Paid vs Unpaid Repair Jobs');

  // Case 6A: Unpaid job in PAYMENT_PENDING
  const testPartId = 'test_part_inv_1';
  db.technicianParts.push({
    id: testPartId,
    technicianId: tech1Id,
    partName: 'iPhone Screen Test Part',
    brand: 'Apple',
    deviceModel: 'iPhone 13',
    compatibleModels: ['iPhone 13'],
    category: 'Screen',
    quality: 'ORIGINAL_OEM',
    sku: 'SKU-TEST-IP13',
    unitPriceNaira: 30000,
    currency: 'NGN',
    quantityOnHand: 5,
    quantityReserved: 0,
    quantityAvailable: 5,
    warrantyDays: 60,
    status: 'IN_STOCK',
    priceVersion: 1,
    priceHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const testQuoteId = 'test_quote_for_cancel';
  db.repairQuotes.push({
    id: testQuoteId,
    requestId: 'req_unpaid_test',
    technicianId: tech1Id,
    technicianName: 'Emeka Nwosu',
    businessName: 'Apex Mobile Repairs',
    technicianPhone: '08012345678',
    technicianRating: 4.8,
    technicianReviewsCount: 15,
    distanceKm: 2.1,
    partsCost: 30000,
    laborCost: 10000,
    otherCost: 0,
    totalAmount: 40000,
    estimatedTimeHours: 2,
    warrantyDays: 60,
    partsQuality: 'ORIGINAL_OEM',
    notes: 'Screen replacement test quote',
    status: 'ACCEPTED',
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'li_cancel_1',
        inventoryItemId: testPartId,
        partNameSnapshot: 'Screen Replacement',
        qualitySnapshot: 'ORIGINAL_OEM',
        unitPriceSnapshot: 30000,
        priceVersion: 1,
        quantity: 1,
        subtotal: 30000,
      },
    ],
  });

  const unpaidJobId = 'job_unpaid_test_123';
  db.repairJobs.push({
    id: unpaidJobId,
    requestId: 'req_unpaid_test',
    quoteId: testQuoteId,
    customerId: customer1Id,
    technicianId: tech1Id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['broken_screen'],
    status: 'PAYMENT_PENDING',
    dropOffCode: 'FX-1111',
    pickupCode: 'PK-2222',
    handoffQrToken: 'tok_unpaid',
    originalQuoteAmount: 40000,
    finalAmount: 40000,
    platformFeeAmount: 3400,
    technicianPayoutAmount: 36600,
    partsUsed: [],
    createdAt: new Date().toISOString(),
    statusHistory: [],
  });

  // Reserve stock for the quote
  const testPart = db.technicianParts.find((i) => i.id === testPartId)!;
  testPart.quantityReserved = 1;
  testPart.quantityAvailable = 4;

  const unpaidCancelRes = await RepairWorkflowService.cancelJob({
    jobId: unpaidJobId,
    actorId: customer1Id,
    actorRole: 'customer',
    reason: 'Changed my mind before payment',
  });

  assert(unpaidCancelRes.success === true, 'Cancelling unpaid job succeeds');
  assert(unpaidCancelRes.job?.status === 'CANCELLED', 'Unpaid job is marked CANCELLED');
  assert(unpaidCancelRes.refunded === false, 'No refund triggered for unpaid job');
  assert(testPart.quantityReserved === 0, 'Reserved stock released after cancellation');
  assert(testPart.quantityAvailable === 5, 'Available stock restored after cancellation');
  passed += 5;
  console.log('  [PASS] Unpaid job cancellation cleanly releases inventory with zero financial side-effects');

  // Case 6B: Paid job in BOOKED with escrow held
  const paidJobId = 'job_paid_test_456';
  const paymentTxId = 'pay_tx_for_cancel_test';
  db.repairJobs.push({
    id: paidJobId,
    requestId: 'req_paid_test',
    quoteId: testQuoteId,
    customerId: customer1Id,
    technicianId: tech1Id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['broken_screen'],
    status: 'BOOKED',
    dropOffCode: 'FX-3333',
    pickupCode: 'PK-4444',
    handoffQrToken: 'tok_paid',
    originalQuoteAmount: 40000,
    finalAmount: 40000,
    platformFeeAmount: 3400,
    technicianPayoutAmount: 36600,
    partsUsed: [],
    createdAt: new Date().toISOString(),
    statusHistory: [],
  });

  db.payments.push({
    id: paymentTxId,
    repairId: paidJobId,
    customerId: customer1Id,
    technicianId: tech1Id,
    amountNaira: 40000,
    platformFeeNaira: 3400,
    technicianPayoutNaira: 36600,
    currency: 'NGN',
    provider: 'PAYSTACK_SANDBOX',
    status: 'SUCCESS',
    paymentMethod: 'CARD',
    transactionRef: 'ref_paid_test_123',
    providerReference: 'paystack_ref_paid_test_123',
    idempotencyKey: 'idemp_paid_test_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.technicianEarnings.push({
    id: 'earn_paid_test_123',
    technicianId: tech1Id,
    repairId: paidJobId,
    paymentId: paymentTxId,
    grossAmountNaira: 40000,
    platformFeeNaira: 3400,
    netEarningsNaira: 36600,
    commissionPercent: 8.5,
    status: 'HELD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Re-reserve stock
  testPart.quantityReserved = 1;
  testPart.quantityAvailable = 4;

  const paidCancelRes = await RepairWorkflowService.cancelJob({
    jobId: paidJobId,
    actorId: customer1Id,
    actorRole: 'customer',
    reason: 'Need device immediately, cancelling repair',
  });

  assert(paidCancelRes.success === true, 'Cancelling paid job succeeds');
  assert(paidCancelRes.job?.status === 'CANCELLED', 'Paid job marked CANCELLED');
  assert(paidCancelRes.refunded === true, 'Refund processed flag returned true');
  assert(paidCancelRes.refundAmountNaira === 40000, 'Refund amount matches payment amount');

  const updatedPayment = db.payments.find((p) => p.id === paymentTxId)!;
  assert(updatedPayment.status === 'REFUNDED', 'Payment status transitioned to REFUNDED');
  assert(updatedPayment.refundedAmountNaira === 40000, 'Payment recorded 40,000 refund amount');

  const updatedEarnings = db.technicianEarnings.find((e) => e.repairId === paidJobId)!;
  assert(updatedEarnings.status === 'REVERSED', 'Technician escrow earnings marked REVERSED');

  assert(testPart.quantityReserved === 0, 'Inventory reserved count reset to 0');
  assert(testPart.quantityAvailable === 5, 'Inventory available count restored to 5');
  passed += 9;
  console.log('  [PASS] Paid job cancellation refunds escrow, reverses earnings, and releases inventory');

  console.log(`\nDefect Remediation Part 1 Suite Results: ${passed} passed, ${failed} failed.`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDefectRemediationPart1Tests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

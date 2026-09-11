import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { db } from '../../server/db';
import { PaymentService } from '../../server/services/paymentService';
import { PaystackClient } from '../../server/services/paystackClient';
import { validateProductionSecrets } from '../../server/config/envValidator';
import { RepairJob, PaymentTransaction, RepairQuote } from '../../src/types/index';

export async function runDatabaseAndSecretsStabilizationTests(): Promise<void> {
  console.log('\n--- Running Database Migration & Secrets Stabilization Tests ---');

  // Test 1: Verify server/db.ts has completely migrated off fs.readFileSync / fs.writeFileSync
  const dbFileContent = fs.readFileSync(path.resolve(process.cwd(), 'server/db.ts'), 'utf-8');
  assert(
    !dbFileContent.includes('fs.readFileSync') && !dbFileContent.includes('fs.writeFileSync'),
    'server/db.ts MUST NOT contain fs.readFileSync or fs.writeFileSync'
  );
  assert(
    !dbFileContent.includes("import fs from 'fs'"),
    'server/db.ts MUST NOT import fs'
  );
  console.log('✓ 1. server/db.ts completely freed from flat-file fs persistence');

  // Test 2: Verify PostgreSQL schema file exists and defines all tables, indexes and constraints
  const schemaPath = path.resolve(process.cwd(), 'server/db/schema.sql');
  assert(fs.existsSync(schemaPath), 'schema.sql must exist');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS users'), 'users table defined in SQL schema');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS repair_jobs'), 'repair_jobs table defined in SQL schema');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS payments'), 'payments table defined in SQL schema');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS technician_earnings'), 'technician_earnings table defined in SQL schema');
  assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS webhook_events'), 'webhook_events table defined in SQL schema');
  assert(schemaContent.includes('idx_repair_jobs_customer'), 'index on repair_jobs.customer_id defined');
  assert(schemaContent.includes('idx_repair_jobs_technician'), 'index on repair_jobs.technician_id defined');
  assert(schemaContent.includes('idx_payment_transactions_ref'), 'index on payments.transaction_ref defined');
  assert(schemaContent.includes('idx_webhook_events_event_key'), 'unique index on webhook_events.event_key defined');
  console.log('✓ 2. PostgreSQL DDL schema with constraints and indexes verified');

  // Test 3: Financial State Transaction — Payment Verify -> Job Booking -> Earnings Creation
  db.resetToSeed();
  const testJobId = 'job_tx_test_1';
  const testQuoteId = 'quote_tx_test_1';
  const testPaymentId = 'pay_tx_test_1';
  const testCustomerId = 'usr_customer_1';
  const testTechId = 'usr_tech_1';
  const testRef = `REF-TX-${Date.now()}`;

  // Seed test request, quote, job, payment in SQL tables
  await db.query(
    `INSERT INTO repair_requests (id, customer_id, device_brand, device_model, device_type, issue_description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    ['req_tx_1', testCustomerId, 'Apple', 'iPhone 13', 'PHONE', 'Screen Cracked', 'PENDING_QUOTES', new Date().toISOString(), new Date().toISOString()]
  );

  const quote: RepairQuote = {
    id: testQuoteId,
    requestId: 'req_tx_1',
    technicianId: testTechId,
    technicianName: 'Emeka Okafor',
    businessName: 'Emeka Repairs',
    technicianPhone: '+2348031111111',
    technicianRating: 4.9,
    technicianReviewsCount: 120,
    distanceKm: 2.5,
    partsCost: 30000,
    laborCost: 10000,
    otherCost: 0,
    totalAmount: 40000,
    estimatedTimeHours: 2,
    warrantyDays: 90,
    partsQuality: 'ORIGINAL_OEM',
    notes: 'Screen replacement',
    status: 'ACCEPTED',
    createdAt: new Date().toISOString(),
  };
  db.repairQuotes.push(quote);
  await db.query(
    `INSERT INTO repair_quotes (id, request_id, technician_id, technician_name, parts_cost_naira, labor_cost_naira, total_amount_naira, estimated_completion_time, warranty_days, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [quote.id, quote.requestId, quote.technicianId, quote.technicianName, quote.partsCost, quote.laborCost, quote.totalAmount, `${quote.estimatedTimeHours} hours`, quote.warrantyDays, quote.status, quote.createdAt]
  );

  const job: RepairJob = {
    id: testJobId,
    requestId: 'req_tx_1',
    quoteId: testQuoteId,
    customerId: testCustomerId,
    technicianId: testTechId,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 13',
    issues: ['Screen Cracked'],
    status: 'DRAFT',
    dropOffCode: '123456',
    pickupCode: '654321',
    handoffQrToken: 'token_qr_tx_1',
    originalQuoteAmount: 40000,
    finalAmount: 40000,
    platformFeeAmount: 4000,
    technicianPayoutAmount: 36000,
    partsUsed: [],
    statusHistory: [{ status: 'DRAFT', timestamp: new Date().toISOString(), actorRole: 'customer' }],
    createdAt: new Date().toISOString(),
  };
  db.repairJobs.push(job);
  await db.query(
    `INSERT INTO repair_jobs (id, request_id, quote_id, customer_id, technician_id, device_brand, device_model, status, original_quote_amount, final_amount, status_history, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [job.id, job.requestId, job.quoteId, job.customerId, job.technicianId, job.deviceBrand, job.deviceModel, job.status, job.originalQuoteAmount, job.finalAmount, JSON.stringify(job.statusHistory), job.createdAt]
  );

  const payment: PaymentTransaction = {
    id: testPaymentId,
    repairId: testJobId,
    customerId: testCustomerId,
    technicianId: testTechId,
    quoteId: testQuoteId,
    amountNaira: 40000,
    platformFeeNaira: 4000,
    technicianPayoutNaira: 36000,
    currency: 'NGN',
    provider: 'PAYSTACK_SANDBOX',
    status: 'INITIATED',
    idempotencyKey: `idemp_tx_${Date.now()}`,
    transactionRef: testRef,
    providerReference: testRef,
    paymentMethod: 'CARD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.payments.push(payment);
  await db.query(
    `INSERT INTO payments (id, repair_id, customer_id, quote_id, amount_naira, platform_fee_naira, technician_payout_naira, escrow_held, status, payment_method, transaction_ref, provider_reference, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [payment.id, payment.repairId, payment.customerId, payment.quoteId, payment.amountNaira, payment.platformFeeNaira, payment.technicianPayoutNaira, true, payment.status, payment.paymentMethod, payment.transactionRef, payment.providerReference, payment.createdAt, payment.updatedAt]
  );

  const verifyResult = await PaymentService.verifyPayment({
    reference: testRef,
    paymentId: testPaymentId,
    actorId: testCustomerId,
    actorRole: 'customer',
  });

  assert(verifyResult.success, 'verifyPayment should succeed in sandbox');
  assert(verifyResult.payment?.status === 'SUCCESS', 'Payment status should be SUCCESS');
  
  const updatedJob = db.repairJobs.find((j) => j.id === testJobId);
  assert(updatedJob?.status === 'BOOKED', 'Job status must be BOOKED');

  const createdEarnings = db.technicianEarnings.find((e) => e.paymentId === testPaymentId);
  assert(createdEarnings !== undefined, 'Technician earnings must be created');
  assert(createdEarnings?.status === 'HELD', 'Earnings status must be HELD upon booking');
  assert(createdEarnings?.netEarningsNaira === 36000, 'Net earnings calculated correctly');
  console.log('✓ 3. Financial state transaction (Payment verify -> Job Booking -> Earnings Creation) verified');

  // Test 4: Database-level Transaction Rollback on failure
  let rollbackCaught = false;
  try {
    await db.transaction(async (tx) => {
      await tx.query('INSERT INTO users (id, email, phone, name, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)', [
        'usr_temp_tx',
        'temp@fixhub.local',
        '+234800000000',
        'Temp User',
        'customer',
        'hash123',
      ]);
      // Simulate unexpected failure partway through
      throw new Error('Simulated atomic transaction failure');
    });
  } catch (err: any) {
    rollbackCaught = true;
    assert(err.message === 'Simulated atomic transaction failure');
  }
  assert(rollbackCaught, 'Transaction failure must be caught');
  const tempUser = db.users.find((u) => u.id === 'usr_temp_tx');
  assert(tempUser === undefined, 'Uncommitted database writes must be rolled back completely');
  console.log('✓ 4. Atomic transaction rollback on midway failure verified');

  // Test 5: Webhook Idempotency & DB Unique Constraint Check
  const webhookPayload = {
    event: 'charge.success',
    data: {
      reference: testRef,
      amount: 4000000,
      currency: 'NGN',
      status: 'success',
    },
  };

  const rawBody = JSON.stringify(webhookPayload);
  const validSignature = PaystackClient.generateHmacSignature(rawBody);

  const whRes1 = await PaymentService.processWebhook({
    rawBody,
    signatureHeader: validSignature,
    eventPayload: webhookPayload,
  });
  assert(whRes1.success, 'First webhook delivery should process successfully');

  // Duplicate delivery with identical event and reference
  const whRes2 = await PaymentService.processWebhook({
    rawBody,
    signatureHeader: validSignature,
    eventPayload: webhookPayload,
  });
  assert(whRes2.success, 'Second webhook delivery should be handled idempotently');
  assert(
    whRes2.message.includes('Idempotent') || whRes2.message.includes('already processed'),
    'Duplicate delivery message should indicate idempotent handling'
  );
  console.log('✓ 5. Webhook database constraint and idempotency verified');

  // Test 6: Production Secret Fail-Fast Validation
  let prodFailUnset = false;
  try {
    validateProductionSecrets(
      {
        NODE_ENV: 'production',
        PAYSTACK_SECRET_KEY: '',
        DATABASE_URL: 'postgres://localhost/test',
        JWT_SECRET: 'a-secure-production-jwt-secret-key-that-is-very-long-and-safe',
      },
      false
    );
  } catch (e: any) {
    prodFailUnset = true;
    assert(e.message.includes('PAYSTACK_SECRET_KEY is required'));
  }
  assert(prodFailUnset, 'Production mode with missing Paystack key must fail fast');

  let prodFailMockKey = false;
  try {
    validateProductionSecrets(
      {
        NODE_ENV: 'production',
        PAYSTACK_SECRET_KEY: 'sk_test_mock_123456789',
        DATABASE_URL: 'postgres://localhost/test',
        JWT_SECRET: 'a-secure-production-jwt-secret-key-that-is-very-long-and-safe',
      },
      false
    );
  } catch (e: any) {
    prodFailMockKey = true;
    assert(e.message.includes('PAYSTACK_SECRET_KEY is required'));
  }
  assert(prodFailMockKey, 'Production mode with mock Paystack key must fail fast');

  let prodFailNoDb = false;
  try {
    validateProductionSecrets(
      {
        NODE_ENV: 'production',
        PAYSTACK_SECRET_KEY: 'sk_live_valid_key_12345',
        JWT_SECRET: 'a-secure-production-jwt-secret-key-that-is-very-long-and-safe',
      },
      false
    );
  } catch (e: any) {
    prodFailNoDb = true;
    assert(e.message.includes('DATABASE_URL or PGHOST must be set when NODE_ENV=production'));
  }
  assert(prodFailNoDb, 'Production mode without DATABASE_URL or PGHOST must fail fast');

  let prodFailInsecureJwt = false;
  try {
    validateProductionSecrets(
      {
        NODE_ENV: 'production',
        PAYSTACK_SECRET_KEY: 'sk_live_' + 'sample_dummy_key_not_real_123',
        DATABASE_URL: 'postgres://localhost/test',
        JWT_SECRET: 'short-dev-secret',
      },
      false
    );
  } catch (e: any) {
    prodFailInsecureJwt = true;
    assert(e.message.includes('JWT_SECRET'));
  }
  assert(prodFailInsecureJwt, 'Production mode with insecure JWT secret must fail fast');

  const validProd = validateProductionSecrets(
    {
      NODE_ENV: 'production',
      PAYSTACK_SECRET_KEY: 'sk_live_' + 'valid_sample_key_for_testing_purposes',
      DATABASE_URL: 'postgres://localhost/test',
      JWT_SECRET: 'a-valid-production-jwt-secret-with-more-than-32-characters-length',
    },
    false
  );
  assert(validProd.valid === true, 'Valid production secrets must pass');

  console.log('✓ 6. Production fail-fast validator logic thoroughly tested and verified');

  console.log('\n--- All Database Migration & Secrets Stabilization Tests Passed! ---');
}

// Auto-run if executed directly
if (process.argv[1]?.includes('database_and_secrets_stabilization')) {
  runDatabaseAndSecretsStabilizationTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}

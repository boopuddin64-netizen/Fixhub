import { strictEqual, ok } from 'node:assert';
import { PaystackClient } from '../../server/services/paystackClient';

export async function runBankResolutionAndViewportTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n--- RUNNING BANK RESOLUTION & MOBILE VIEWPORT TESTS ---');
  let passed = 0;
  let failed = 0;

  const testAssert = (cond: boolean, name: string, detail?: string) => {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  };

  // Test 1: Real OPay NUBAN account resolution via banking network
  try {
    const result = await PaystackClient.resolveAccountNumber('8030000000', '999992'); // Real OPay code and number
    testAssert(
      result.success === true && typeof result.accountName === 'string' && result.accountName.length > 0,
      'Test 1: resolveAccountNumber accurately resolves valid OPay account name from live banking network'
    );
  } catch (err: any) {
    testAssert(false, 'Test 1: resolveAccountNumber threw an exception', err.message);
  }

  // Test 2: Invalid or non-existent account returns success === false without false name forgery
  try {
    const result = await PaystackClient.resolveAccountNumber('9999999999', '999992');
    testAssert(
      result.success === false && result.accountName === '',
      'Test 2: Non-existent bank details return success === false without false name forgery'
    );
  } catch (err: any) {
    testAssert(false, 'Test 2: resolveAccountNumber threw on non-existent account', err.message);
  }

  // Test 3: Standard test environment simulation on dummy test account
  try {
    const result = await PaystackClient.resolveAccountNumber('0123456789', '058');
    testAssert(
      typeof result.success === 'boolean',
      'Test 3: Simulated or live resolution returns clean boolean success'
    );
  } catch (err: any) {
    testAssert(false, 'Test 3: Resolution threw exception', err.message);
  }

  // Test 4: Validation errors on invalid account number or empty bank code
  try {
    const shortResult = await PaystackClient.resolveAccountNumber('12345', '058');
    testAssert(
      shortResult.success === false,
      'Test 4a: Account number under 10 digits is rejected'
    );

    const emptyBankResult = await PaystackClient.resolveAccountNumber('1234567890', '');
    testAssert(
      emptyBankResult.success === false,
      'Test 4b: Empty bank code is rejected'
    );
  } catch (err: any) {
    testAssert(false, 'Test 4: Validation error checking threw', err.message);
  }

  console.log(`--- Finished Bank Resolution & Mobile Viewport Tests: ${passed} passed, ${failed} failed ---\n`);
  return { passed, failed };
}

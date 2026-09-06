import test from 'node:test';
import assert from 'node:assert';
import { runTestSuite } from './run_all_tests';

test('Fix Hub Comprehensive Security and Integration Test Suite', async () => {
  const result = await runTestSuite();
  assert.strictEqual(result.failed, 0, `Expected 0 failed tests, got ${result.failed}`);
  assert.ok(result.passed >= 80, `Expected at least 80 passing tests, got ${result.passed}`);
});

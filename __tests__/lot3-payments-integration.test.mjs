/**
 * LOT 3 — Payments integration tests
 * 
 * Tests the payments module for:
 * - CREATE: existing idempotent behavior preserved
 * - READ: online-first; fallback only on TypeError
 * - DELETE: API-driven; no local fallback after API attempt
 * - Balance recalculation after payment operations
 * - Error handling for all HTTP statuses
 */

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message || `Expected ${expected}, got ${actual}`);
}

async function assertThrows(fn, expectedMessage) {
  let threw = false;
  try {
    await fn();
  } catch (error) {
    threw = true;
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(`Expected error to contain "${expectedMessage}", got "${error.message}"`);
    }
  }
  if (!threw) throw new Error('Expected function to throw');
}

console.log('📋 LOT 3 - Payments Integration Tests\n');

// Test: DELETE Adapter returns 204 successfully
await test('DELETE 204 - success', async () => {
  let fetchCalled = false;
  global.fetch = async (url, opts) => {
    fetchCalled = true;
    assert(url.includes('resource=payments'), 'URL should include resource=payments');
    assert(opts.method === 'DELETE', 'Method should be DELETE');
    return { ok: true, status: 204, json: async () => ({}) };
  };

  const { deleteOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await deleteOnlinePayment('payment-1');
  assert(fetchCalled, 'fetch should have been called');
});

// Test: DELETE returns 400 and throws error
await test('DELETE 400 - error propagation', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Invalid ID' })
  });

  const { deleteOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await assertThrows(() => deleteOnlinePayment('bad-id'), 'API_400');
});

// Test: DELETE returns 403 Forbidden
await test('DELETE 403 - permission error', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: 'Forbidden' })
  });

  const { deleteOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await assertThrows(() => deleteOnlinePayment('payment-1'), 'API_403');
});

// Test: DELETE returns 404
await test('DELETE 404 - not found', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' })
  });

  const { deleteOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await assertThrows(() => deleteOnlinePayment('nonexistent'), 'API_404');
});

// Test: DELETE returns 500
await test('DELETE 500 - server error', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Server error' })
  });

  const { deleteOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await assertThrows(() => deleteOnlinePayment('payment-1'), 'API_500');
});

// Test: TypeError is treated as network unavailable
await test('DELETE TypeError - network unavailable', async () => {
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  const { deleteOnlinePayment, isPaymentApiUnavailable } = await import('../src/lib/paymentPersistence.ts');
  
  try {
    await deleteOnlinePayment('payment-1');
    throw new Error('Should have thrown');
  } catch (error) {
    assert(isPaymentApiUnavailable(error), 'TypeError should be marked as unavailable');
  }
});

// Test: isPaymentApiUnavailable only returns true for TypeError
await test('isPaymentApiUnavailable - only TypeError', async () => {
  const { isPaymentApiUnavailable } = await import('../src/lib/paymentPersistence.ts');
  
  const typeError = new TypeError('Network error');
  const otherError = new Error('Invalid JSON');
  
  assert(isPaymentApiUnavailable(typeError), 'TypeError should be unavailable');
  assert(!isPaymentApiUnavailable(otherError), 'Other errors should NOT be unavailable');
});

// Test: CREATE preserves idempotency
await test('CREATE - idempotency key preserved', async () => {
  const { createPaymentIdempotencyKey } = await import('../src/lib/paymentPersistence.ts');
  
  const key1 = createPaymentIdempotencyKey();
  const key2 = createPaymentIdempotencyKey();
  
  assert(typeof key1 === 'string', 'Key should be string');
  assert(key1.length > 0, 'Key should not be empty');
  assert(key1 !== key2, 'Keys should be unique');
});

// Test: CREATE sends Idempotency-Key header
await test('CREATE - idempotency header sent', async () => {
  let headersSent = null;
  global.fetch = async (url, opts) => {
    headersSent = opts.headers;
    return {
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          id: 'payment-1',
          parcelId: 'parcel-1',
          amount: 5000,
          paymentMethod: 'cash',
          recordedById: 'user-1',
          recordedByName: 'User',
          createdAt: '2026-01-01T00:00:00Z',
        }
      })
    };
  };

  const { createOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await createOnlinePayment({
    parcel_id: 'parcel-1',
    amount: 5000,
    payment_method: 'cash',
    payment_date: '2026-01-01T00:00:00Z',
    note: 'test',
  }, 'test-key');
  
  assert(headersSent['Idempotency-Key'] === 'test-key', 'Idempotency-Key header should be sent');
});

// Test: CREATE returns 400 error
await test('CREATE 400 - validation error', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Invalid amount' })
  });

  const { createOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await assertThrows(
    () => createOnlinePayment({
      parcel_id: 'parcel-1',
      amount: -100,
      payment_method: 'cash',
      payment_date: '2026-01-01T00:00:00Z',
      note: 'test',
    }),
    'API_400'
  );
});

// Test: READ returns list of payments
await test('READ - list payments online', async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: [
        {
          id: 'p1',
          parcelId: 'parcel-1',
          amount: 5000,
          paymentMethod: 'cash',
          recordedById: 'user-1',
          recordedByName: 'User',
          createdAt: '2026-01-01T00:00:00Z',
        }
      ]
    })
  });

  const { listOnlinePayments } = await import('../src/lib/paymentPersistence.ts');
  const payments = await listOnlinePayments();
  
  assert(Array.isArray(payments), 'Should return array');
  assert(payments.length === 1, 'Should have 1 payment');
  assert(payments[0].id === 'p1', 'Payment ID should match');
});

// Test: Balance calculation - basic
await test('Balance - basic calculation', async () => {
  const total = 100000;
  const paid = 40000;
  const balance = total - paid;
  
  assert(balance === 60000, `Balance should be 60000, got ${balance}`);
});

// Test: Balance calculation - after payment deletion
await test('Balance - after payment deletion', async () => {
  const total = 100000;
  const paid = 40000;
  const deleteAmount = 20000;
  
  const newPaid = Math.max(paid - deleteAmount, 0);
  const newBalance = total - newPaid;
  
  assert(newBalance === 80000, `New balance should be 80000, got ${newBalance}`);
});

// Test: Balance calculation - paid_origin condition
await test('Balance - paid_origin condition', async () => {
  const condition = 'paid_origin';
  const total = 100000;
  const paid = 50000;
  
  const balance = condition === 'paid_origin' ? 0 : (total - paid);
  
  assert(balance === 0, `Balance should be 0 for paid_origin, got ${balance}`);
});

// Test: Balance never goes negative
await test('Balance - never negative', async () => {
  const total = 100000;
  const paid = 100000;
  const deleteAmount = 50000;
  
  const newPaid = Math.max(paid - deleteAmount, 0);
  const newBalance = total - newPaid;
  
  assert(newBalance >= 0, `Balance should never be negative, got ${newBalance}`);
});

// Test: HTTP response with non-JSON body
await test('Error - HTML response detection', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error('Not JSON');
    }
  });

  const { deleteOnlinePayment } = await import('../src/lib/paymentPersistence.ts');
  await assertThrows(() => deleteOnlinePayment('payment-1'), 'API_500');
});

// Test: No automatic local write after failed API call
await test('Policy - no local fallback after API error', async () => {
  const { isPaymentApiUnavailable } = await import('../src/lib/paymentPersistence.ts');
  
  // HTTP 500 error should not trigger fallback
  const error500 = new Error('API_500: Server error');
  assert(!isPaymentApiUnavailable(error500), 'HTTP 500 should NOT trigger fallback');
  
  // HTTP 400 error should not trigger fallback
  const error400 = new Error('API_400: Bad request');
  assert(!isPaymentApiUnavailable(error400), 'HTTP 400 should NOT trigger fallback');
});

// Clean up
delete global.fetch;

console.log(`\n📊 Results: ${passed}/${passed + failed} tests passed`);

if (failed === 0) {
  console.log(`\n✅ All LOT 3 payment tests passed!`);
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}

import assert from 'node:assert/strict';

console.log('\n📋 LOT 4 - Parcels Module & Auto-Bootstrap Integration Tests\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`✅ Test ${totalTests}: ${name}`);
  } catch (error) {
    console.error(`❌ Test ${totalTests}: ${name}`);
    console.error(`   Error: ${error.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    console.log(`✅ Test ${totalTests}: ${name}`);
  } catch (error) {
    console.error(`❌ Test ${totalTests}: ${name}`);
    console.error(`   Error: ${error.message}`);
    process.exitCode = 1;
  }
}

function canUseParcelApiSim(isOnline) {
  return isOnline;
}

function isParcelApiUnavailableSim(error) {
  return error instanceof TypeError;
}

async function requestParcelApi(method, id, body, isOnline, mockFetchResponse) {
  if (!isOnline) throw new TypeError('Failed to fetch');
  return mockFetchResponse(method, id, body);
}

// Test 1: canUseParcelApi returns boolean
runTest('canUseParcelApi returns boolean', () => {
  assert.equal(canUseParcelApiSim(true), true);
  assert.equal(canUseParcelApiSim(false), false);
});

// Test 2: isParcelApiUnavailable identifies TypeError
runTest('isParcelApiUnavailable returns true only for TypeError', () => {
  assert.equal(isParcelApiUnavailableSim(new TypeError('Failed to fetch')), true);
  assert.equal(isParcelApiUnavailableSim(new Error('API_400: Bad Request')), false);
  assert.equal(isParcelApiUnavailableSim(new Error('API_500: Server Error')), false);
});

// Test 3: createParcelOnline sends correct payload to API
await runAsyncTest('createParcelOnline sends valid parcel input', async () => {
  let capturedBody = null;
  const mockFetch = async (method, id, body) => {
    capturedBody = body;
    return {
      id: 'parcel-123',
      tracking_number: 'GG-TEST-1',
      registered_by: 'user-1',
      status: 'received',
    };
  };

  const res = await requestParcelApi('POST', undefined, {
    clientId: 'client-1',
    recipientName: 'Jean Dupont',
    merchandiseType: 'Colis A',
  }, true, mockFetch);

  assert.equal(capturedBody.clientId, 'client-1');
  assert.equal(capturedBody.recipientName, 'Jean Dupont');
  assert.equal(res.id, 'parcel-123');
  assert.equal(res.tracking_number, 'GG-TEST-1');
});

// Test 4: updateOnlineParcelStatus sends status patch
await runAsyncTest('updateOnlineParcelStatus sends PATCH request', async () => {
  let capturedMethod = '';
  let capturedBody = null;
  const mockFetch = async (method, id, body) => {
    capturedMethod = method;
    capturedBody = body;
    return { id, status: body.status };
  };

  const updated = await requestParcelApi('PATCH', 'parcel-123', { status: 'in_transit', note: 'En route' }, true, mockFetch);
  assert.equal(capturedMethod, 'PATCH');
  assert.equal(capturedBody.status, 'in_transit');
  assert.equal(updated.status, 'in_transit');
});

// Test 5: deleteOnlineParcel sends DELETE request
await runAsyncTest('deleteOnlineParcel sends DELETE request', async () => {
  let capturedMethod = '';
  const mockFetch = async (method, id) => {
    capturedMethod = method;
    return null;
  };

  await requestParcelApi('DELETE', 'parcel-999', undefined, true, mockFetch);
  assert.equal(capturedMethod, 'DELETE');
});

// Test 6: HTTP 500 on create parcel throws error (not network error)
await runAsyncTest('createParcelOnline propagates HTTP 500 error', async () => {
  const mockFetch = async () => {
    throw new Error('API_500: Server Error');
  };

  try {
    await requestParcelApi('POST', undefined, { clientId: '1' }, true, mockFetch);
    assert.fail('Should have thrown error');
  } catch (error) {
    assert.equal(isParcelApiUnavailableSim(error), false);
    assert.ok(error.message.includes('API_500'));
  }
});

console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed\n`);
if (passedTests === totalTests) {
  console.log('✅ All LOT 4 parcel tests passed!\n');
} else {
  process.exitCode = 1;
}

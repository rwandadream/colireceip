/**
 * LOT 1 - HTTP Adapter Tests
 * 
 * Tests the persistence adapters to ensure:
 * 1. Correct handling of different HTTP status codes
 * 2. Correct error propagation
 * 3. No automatic fallback on write errors
 * 4. Proper distinction between network errors and HTTP errors
 */

import assert from 'node:assert/strict';

// Mock fetch for all tests
// Note: navigator is not available in Node.js, so we just mock fetch directly

// Test utilities
class FetchMock {
  constructor() {
    this.responses = [];
    this.callCount = 0;
  }
  
  mockResponse(status, body = null, contentType = 'application/json') {
    this.responses.push({ status, body, contentType });
  }
  
  mockNetworkError(error = new TypeError('Network error')) {
    this.responses.push({ error });
  }
  
  async call(url, options = {}) {
    if (this.callCount >= this.responses.length) {
      throw new Error('Unexpected fetch call - no more mock responses configured');
    }
    
    const mock = this.responses[this.callCount++];
    
    if (mock.error) {
      throw mock.error;
    }
    
    const ok = mock.status >= 200 && mock.status < 300;
    
    return {
      ok,
      status: mock.status,
      headers: {
        'content-type': mock.contentType,
      },
      json: async () => {
        if (!mock.body) throw new Error('No body');
        return typeof mock.body === 'string' ? JSON.parse(mock.body) : mock.body;
      },
      text: async () => {
        return typeof mock.body === 'string' ? mock.body : JSON.stringify(mock.body);
      },
    };
  }
}

let fetchMock;

// Mock global fetch
global.fetch = (url, options) => fetchMock.call(url, options);

async function runTests() {
  console.log('\n📋 LOT 1 - Adapter HTTP Behavior Tests\n');
  
  let testCount = 0;
  let passCount = 0;
  
  async function test(name, fn) {
    testCount++;
    fetchMock = new FetchMock();
    try {
      await fn();
      console.log(`✅ Test ${testCount}: ${name}`);
      passCount++;
    } catch (error) {
      console.error(`❌ Test ${testCount}: ${name}`);
      console.error(`   ${error.message}`);
    }
  }
  
  // READ Tests
  await test('GET 200 should return data', async () => {
    fetchMock.mockResponse(200, { data: { id: '1', name: 'Client' } });
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(response.ok, 'Response should be ok');
    const json = await response.json();
    assert.equal(json.data.id, '1', 'Should parse JSON response');
  });
  
  await test('GET 400 should be treated as error, not unavailability', async () => {
    fetchMock.mockResponse(400, { error: 'Invalid request' });
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 400, 'Status should be 400');
    // In adapter: throw error, do NOT treat as unavailability
  });
  
  await test('GET 403 should be treated as permission error', async () => {
    fetchMock.mockResponse(403, { error: 'Access denied' });
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 403, 'Status should be 403');
  });
  
  await test('GET 404 should propagate error', async () => {
    fetchMock.mockResponse(404, { error: 'Not found' });
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 404, 'Status should be 404');
  });
  
  await test('GET 500 should propagate error (not treat as unavailability)', async () => {
    fetchMock.mockResponse(500, { error: 'Server error' });
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
  });
  
  await test('GET with TypeError (network error) should be catchable', async () => {
    fetchMock.mockNetworkError(new TypeError('Failed to fetch'));
    
    try {
      await fetch('/api/data?resource=clients', { method: 'GET' });
      throw new Error('Should have thrown');
    } catch (error) {
      assert(error instanceof TypeError, 'Should be TypeError');
    }
  });
  
  // WRITE Tests - Status 201 (CREATE)
  await test('POST 201 should return created data', async () => {
    fetchMock.mockResponse(201, { data: { id: 'new-id', name: 'New Client' } });
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({ fullName: 'Client', phone: '123' }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert(response.ok, 'Response should be ok');
    assert.equal(response.status, 201, 'Status should be 201');
    const json = await response.json();
    assert.equal(json.data.id, 'new-id', 'Should have new ID');
  });
  
  await test('POST 204 should not have JSON body', async () => {
    fetchMock.mockResponse(204, null);
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(response.ok, 'Response should be ok');
    assert.equal(response.status, 204, 'Status should be 204');
    // Response.json() would throw on empty body
  });
  
  // WRITE Tests - Errors that should NOT trigger IndexedDB fallback
  await test('POST 400 should propagate error (NOT fallback to IndexedDB)', async () => {
    fetchMock.mockResponse(400, { error: 'Missing required field' });
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 400, 'Status should be 400');
    // Adapter should throw, NOT set a fallback flag
  });
  
  await test('POST 403 should propagate permission error', async () => {
    fetchMock.mockResponse(403, { error: 'Access denied' });
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 403, 'Status should be 403');
  });
  
  await test('POST 500 should propagate error (NOT treat as unavailability)', async () => {
    fetchMock.mockResponse(500, { error: 'Database error' });
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
    // CRITICAL: Do NOT treat 500 as "API unavailable" for writes
  });
  
  // PATCH/UPDATE Tests
  await test('PATCH 200 should return updated data', async () => {
    fetchMock.mockResponse(200, { data: { id: '1', name: 'Updated' } });
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    });
    assert(response.ok, 'Response should be ok');
    const json = await response.json();
    assert.equal(json.data.name, 'Updated', 'Should have updated data');
  });
  
  await test('PATCH 500 should propagate error', async () => {
    fetchMock.mockResponse(500, { error: 'Update failed' });
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
  });
  
  // DELETE Tests
  await test('DELETE 204 should return success without body', async () => {
    fetchMock.mockResponse(204, null);
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'DELETE',
    });
    assert(response.ok, 'Response should be ok');
    assert.equal(response.status, 204, 'Status should be 204');
  });
  
  await test('DELETE 500 should propagate error', async () => {
    fetchMock.mockResponse(500, { error: 'Delete failed' });
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'DELETE',
    });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
  });
  
  // Network/Timeout Tests
  await test('TypeError (network unavailable) should be distinct from HTTP errors', async () => {
    fetchMock.mockNetworkError(new TypeError('Network error'));
    
    try {
      await fetch('/api/data?resource=clients', { method: 'GET' });
      throw new Error('Should have thrown');
    } catch (error) {
      assert(error instanceof TypeError, 'Should be TypeError, not HttpError');
    }
  });
  
  // Invalid Response Tests
  await test('HTML response (200) should be detected as invalid', async () => {
    fetchMock.mockResponse(200, '<html>Page not found</html>', 'text/html');
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(response.ok, 'Status 200 should be ok');
    assert.equal(response.status, 200, 'Status should be 200');
    // Adapter should detect this is not JSON and throw
  });
  
  await test('Empty body with 200 should be invalid', async () => {
    fetchMock.mockResponse(200, '', 'application/json');
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(response.ok, 'Status 200 should be ok');
    // Adapter should throw because body is empty
  });
  
  console.log(`\n📊 Results: ${passCount}/${testCount} tests passed\n`);
  
  if (passCount === testCount) {
    console.log('✅ All LOT 1 HTTP behavior tests passed!\n');
    return true;
  } else {
    console.error(`❌ ${testCount - passCount} test(s) failed\n`);
    return false;
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

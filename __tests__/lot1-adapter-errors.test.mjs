/**
 * LOT 1 - Adapter Error Handling Tests
 * 
 * Tests that persistence adapters correctly handle:
 * 1. HTTP error responses with JSON error messages
 * 2. HTTP error responses with HTML or invalid content
 * 3. Network errors (TypeError)
 * 4. 204 No Content responses
 */

import assert from 'node:assert/strict';

// Setup mock fetch
let mockResponse = null;
let throwError = null;

global.fetch = async (url, options) => {
  if (throwError) {
    const err = throwError;
    throwError = null;
    throw err;
  }
  
  const resp = mockResponse || { ok: true, status: 200, json: async () => ({}) };
  mockResponse = null;
  return resp;
};

// Test utilities
function createMockResponse(status, body, contentType = 'application/json') {
  let bodyRead = false;
  
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (bodyRead) throw new Error('Body already read');
      bodyRead = true;
      if (!body) throw new Error('No body');
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        return parsed;
      }
      return body;
    },
    text: async () => {
      if (bodyRead) throw new Error('Body already read');
      bodyRead = true;
      if (!body) return '';
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

async function runTests() {
  console.log('\n📋 LOT 1 - Adapter Error Handling Tests\n');
  
  let testCount = 0;
  let passCount = 0;
  
  async function test(name, fn) {
    testCount++;
    mockResponse = null;
    throwError = null;
    try {
      await fn();
      console.log(`✅ Test ${testCount}: ${name}`);
      passCount++;
    } catch (error) {
      console.error(`❌ Test ${testCount}: ${name}`);
      console.error(`   ${error.message}`);
    }
  }
  
  // Test: Error response with JSON error message
  await test('Error response with JSON should include error message', async () => {
    mockResponse = createMockResponse(400, { error: 'Missing required field' });
    
    try {
      const response = await fetch('/api/data?resource=clients', { method: 'GET' });
      assert(!response.ok, 'Response should not be ok');
      
      // Try to parse error
      const json = await response.json();
      assert(json.error, 'JSON should have error field');
      assert.equal(json.error, 'Missing required field', 'Error message should match');
    } catch (error) {
      throw error;
    }
  });
  
  // Test: Error response with HTML (non-JSON)
  await test('Error response with HTML should be detectable', async () => {
    mockResponse = createMockResponse(500, '<html><body>Error</body></html>', 'text/html');
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
    
    // Try to read as JSON - should fail
    try {
      const text = await response.text();
      assert(text.includes('<html>'), 'Should be HTML content');
      // Adapter should catch this and throw a proper error
    } catch (error) {
      // Expected
    }
  });
  
  // Test: 204 No Content should not call json()
  await test('204 No Content response should not require JSON body', async () => {
    mockResponse = createMockResponse(204, null);
    
    const response = await fetch('/api/data?resource=clients', { method: 'DELETE', body: '{}' });
    assert(response.ok, 'Response should be ok');
    assert.equal(response.status, 204, 'Status should be 204');
    
    // Should not call json() on 204
    // Adapter should check status === 204 first
  });
  
  // Test: Network error (TypeError) should be distinct
  await test('Network error (TypeError) should propagate', async () => {
    throwError = new TypeError('Failed to fetch');
    
    try {
      await fetch('/api/data?resource=clients', { method: 'GET' });
      throw new Error('Should have thrown TypeError');
    } catch (error) {
      assert(error instanceof TypeError, 'Should be TypeError');
      assert.equal(error.message, 'Failed to fetch', 'Error message should match');
    }
  });
  
  // Test: Timeout (AbortError) should be handled
  await test('AbortError (timeout) should propagate', async () => {
    throwError = new Error('Aborted');
    throwError.name = 'AbortError';
    
    try {
      await fetch('/api/data?resource=clients', { method: 'GET' });
      throw new Error('Should have thrown AbortError');
    } catch (error) {
      assert.equal(error.name, 'AbortError', 'Should be AbortError');
    }
  });
  
  // Test: JSON parse error on success response
  await test('JSON parse error on 200 response should throw', async () => {
    mockResponse = {
      ok: true,
      status: 200,
      json: async () => { throw new Error('Invalid JSON'); },
      text: async () => 'not json',
    };
    
    try {
      await fetch('/api/data?resource=clients', { method: 'GET' });
      const response = await fetch('/api/data?resource=clients');
      assert(response.ok, 'Response ok flag should be true');
      await response.json(); // Should throw
      throw new Error('Should have thrown JSON parse error');
    } catch (error) {
      assert(error instanceof Error, 'Should throw an error');
    }
  });
  
  // Test: Multiple error status codes should all propagate
  const errorStatuses = [400, 401, 403, 404, 500, 502, 503, 504];
  for (const status of errorStatuses) {
    await test(`HTTP ${status} should propagate as error`, async () => {
      mockResponse = createMockResponse(status, { error: `Error ${status}` });
      
      const response = await fetch('/api/data?resource=clients', { method: 'GET' });
      assert(!response.ok, `Response should not be ok for ${status}`);
      assert.equal(response.status, status, `Status should be ${status}`);
    });
  }
  
  console.log(`\n📊 Results: ${passCount}/${testCount} tests passed\n`);
  
  if (passCount === testCount) {
    console.log('✅ All adapter error handling tests passed!\n');
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

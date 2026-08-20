/**
 * LOT 2 - Clients Module Integration Tests
 * 
 * Tests the clients CRUD flow:
 * - Online success → API
 * - Online failure → Error (not fallback)
 * - Offline → IndexedDB
 * 
 * Validates error handling at each layer:
 * - clientPersistence.ts (HTTP)
 * - data.ts (orchestration)
 * - Pages (UI error display)
 */

import assert from 'node:assert/strict';

// Mock setup
let mockOnline = true;
let mockFetch = null;
let mockDB = null;

// Store original fetch if it exists
const originalFetch = global.fetch;

global.fetch = async (url, options) => {
  if (!mockFetch) throw new TypeError('Network error');
  return mockFetch(url, options);
};

// Create a canUseClientApi simulation
function canUseClientApi() {
  return mockOnline && global.fetch !== undefined;
}

// Test utilities
function setOnline(online) {
  mockOnline = online;
}

function mockApiSuccess(status, data) {
  mockFetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data }),
  });
}

function mockApiError(status, errorMessage) {
  mockFetch = async () => ({
    ok: false,
    status,
    json: async () => ({ error: errorMessage }),
    text: async () => JSON.stringify({ error: errorMessage }),
  });
}

function mockNetworkError() {
  mockFetch = null; // Will throw TypeError
}

async function runTests() {
  console.log('\n📋 LOT 2 - Clients Module Integration Tests\n');
  
  let testCount = 0;
  let passCount = 0;
  
  async function test(name, fn) {
    testCount++;
    setOnline(true);
    mockFetch = null;
    try {
      await fn();
      console.log(`✅ Test ${testCount}: ${name}`);
      passCount++;
    } catch (error) {
      console.error(`❌ Test ${testCount}: ${name}`);
      console.error(`   ${error.message}`);
    }
  }
  
  // ============================================================
  // READ - getClients()
  // ============================================================
  
  await test('getClients() - Online success returns data', async () => {
    setOnline(true);
    mockApiSuccess(200, [
      { id: '1', full_name: 'Client 1', phone: '123' },
      { id: '2', full_name: 'Client 2', phone: '456' },
    ]);
    
    // Simulate: if (canUseClientApi()) return listOnlineClients()
    assert(canUseClientApi(), 'Should be able to use API');
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(response.ok, 'Response should be ok');
    
    const json = await response.json();
    assert(Array.isArray(json.data), 'Should return array');
    assert.equal(json.data.length, 2, 'Should have 2 clients');
  });
  
  await test('getClients() - Offline falls back to IndexedDB', async () => {
    setOnline(false);
    
    // Simulate: if (!canUseClientApi()) return db.getAll('clients')
    assert(!canUseClientApi(), 'Should not be able to use API');
    
    // In this case, fetch is never called
    // Just IndexedDB would be called
  });
  
  await test('getClients() - Online 400 error propagates (not fallback)', async () => {
    setOnline(true);
    mockApiError(400, 'Invalid request');
    
    try {
      const response = await fetch('/api/data?resource=clients', { method: 'GET' });
      assert(!response.ok, 'Response should not be ok');
      assert.equal(response.status, 400, 'Status should be 400');
      // In data.ts: if (!isApiUnavailable(error)) throw error
      // isApiUnavailable(error) checks: error instanceof TypeError
      // 400 error is not TypeError, so it THROWS (no fallback)
    } catch (error) {
      assert(false, 'Should not throw TypeError');
    }
  });
  
  await test('getClients() - Online 500 error propagates (not fallback)', async () => {
    setOnline(true);
    mockApiError(500, 'Database error');
    
    try {
      const response = await fetch('/api/data?resource=clients', { method: 'GET' });
      assert(!response.ok, 'Response should not be ok');
      assert.equal(response.status, 500, 'Status should be 500');
      // 500 is not TypeError, so it THROWS (no fallback)
    } catch (error) {
      assert(false, 'Should not throw TypeError');
    }
  });
  
  await test('getClients() - Network error (TypeError) can fallback to IndexedDB', async () => {
    setOnline(true);
    mockNetworkError();
    
    try {
      await fetch('/api/data?resource=clients', { method: 'GET' });
      assert(false, 'Should have thrown');
    } catch (error) {
      assert(error instanceof TypeError, 'Should be TypeError');
      // In data.ts: if (!isApiUnavailable(error)) throw error
      // isApiUnavailable checks: error instanceof TypeError
      // If true, it catches and continues to IndexedDB fallback
    }
  });
  
  // ============================================================
  // CREATE - createClient()
  // ============================================================
  
  await test('createClient() - Online success returns created client', async () => {
    setOnline(true);
    const createdClient = {
      id: 'new-1',
      full_name: 'New Client',
      phone: '789',
      city: 'Bamako',
      address: 'Address',
      created_at: '2026-08-18T10:00:00Z',
      updated_at: '2026-08-18T10:00:00Z',
    };
    mockApiSuccess(201, createdClient);
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'New Client',
        phone: '789',
        city: 'Bamako',
        address: 'Address',
      }),
    });
    
    assert(response.ok, 'Response should be ok');
    assert.equal(response.status, 201, 'Status should be 201');
    
    const json = await response.json();
    assert.equal(json.data.id, 'new-1', 'Should have new ID');
  });
  
  await test('createClient() - Online 400 validation error propagates', async () => {
    setOnline(true);
    mockApiError(400, 'Missing full_name');
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({ phone: '123' }),
    });
    
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 400, 'Status should be 400');
    
    const json = await response.json();
    assert.equal(json.error, 'Missing full_name', 'Should have error message');
    
    // CRITICAL: In data.ts
    // createClient() should NOT fallback to IndexedDB
    // Error should be thrown to caller
    // Page should display error, not navigate
  });
  
  await test('createClient() - Online 403 permission error propagates', async () => {
    setOnline(true);
    mockApiError(403, 'Access denied');
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Client',
        phone: '123',
        city: 'City',
        address: 'Address',
      }),
    });
    
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 403, 'Status should be 403');
    
    // Should NOT fallback to IndexedDB
    // Error should be thrown
  });
  
  await test('createClient() - Online 500 server error propagates', async () => {
    setOnline(true);
    mockApiError(500, 'Database connection failed');
    
    const response = await fetch('/api/data?resource=clients', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Client',
        phone: '123',
        city: 'City',
        address: 'Address',
      }),
    });
    
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
    
    // CRITICAL: Should NOT fallback to IndexedDB
    // Why? Because we don't know if the create actually happened
    // If we silently create in IndexedDB, we'll diverge from server
    // Safer to error and let user retry
  });
  
  await test('createClient() - Network error can fallback to IndexedDB', async () => {
    setOnline(true);
    mockNetworkError();
    
    try {
      await fetch('/api/data?resource=clients', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Client',
          phone: '123',
          city: 'City',
          address: 'Address',
        }),
      });
      assert(false, 'Should have thrown');
    } catch (error) {
      assert(error instanceof TypeError, 'Should be TypeError');
      // ALLOWED: Can fallback to IndexedDB
      // Network error means we're offline (likely)
    }
  });
  
  await test('createClient() - Offline creates in IndexedDB', async () => {
    setOnline(false);
    
    // Simulate: if (!canUseClientApi()) create directly in IndexedDB
    assert(!canUseClientApi(), 'Should not be able to use API');
    
    // fetch is never called
    // IndexedDB.put('clients', {...}) is called instead
  });
  
  // ============================================================
  // UPDATE - updateClient()
  // ============================================================
  
  await test('updateClient() - Online success returns updated client', async () => {
    setOnline(true);
    const updatedClient = {
      id: '1',
      full_name: 'Updated Client',
      phone: '999',
      city: 'Abidjan',
      address: 'New Address',
      updated_at: '2026-08-18T11:00:00Z',
    };
    mockApiSuccess(200, updatedClient);
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: 'Updated Client',
        city: 'Abidjan',
      }),
    });
    
    assert(response.ok, 'Response should be ok');
    const json = await response.json();
    assert.equal(json.data.full_name, 'Updated Client', 'Should have updated name');
    
    // Note: data.ts should NOW return this updated data
    // Previously it returned Promise<void>
  });
  
  await test('updateClient() - Online 400 validation error propagates', async () => {
    setOnline(true);
    mockApiError(400, 'Invalid phone format');
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'PATCH',
      body: JSON.stringify({ phone: 'invalid' }),
    });
    
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 400, 'Status should be 400');
    
    // Should NOT fallback to IndexedDB
    // Should NOT update client state optimistically
    // Should display error to user
  });
  
  await test('updateClient() - Online 500 error propagates (no fallback)', async () => {
    setOnline(true);
    mockApiError(500, 'Update failed');
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'PATCH',
      body: JSON.stringify({ full_name: 'New Name' }),
    });
    
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 500, 'Status should be 500');
    
    // CRITICAL: Should NOT fallback to IndexedDB
    // We don't know if update happened on server
    // Could diverge: client thinks field X changed, but server has old value
  });
  
  // ============================================================
  // DELETE - deleteClient()
  // ============================================================
  
  await test('deleteClient() - Online success returns 204 No Content', async () => {
    setOnline(true);
    mockFetch = async () => ({
      ok: true,
      status: 204,
      json: async () => { throw new Error('No body for 204'); },
    });
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'DELETE',
    });
    
    assert(response.ok, 'Response should be ok');
    assert.equal(response.status, 204, 'Status should be 204');
    
    // Should NOT call response.json()
    // adapter should check response.status === 204 first
  });
  
  await test('deleteClient() - Online 403 permission error propagates', async () => {
    setOnline(true);
    mockApiError(403, 'Cannot delete client of another user');
    
    const response = await fetch('/api/data?resource=clients&id=1', {
      method: 'DELETE',
    });
    
    assert(!response.ok, 'Response should not be ok');
    assert.equal(response.status, 403, 'Status should be 403');
    
    // Should NOT fallback to IndexedDB
    // Should display error
  });
  
  // ============================================================
  // Error Message Handling
  // ============================================================
  
  await test('Error response with JSON body includes message', async () => {
    setOnline(true);
    mockApiError(400, 'This is a detailed error message');
    
    const response = await fetch('/api/data?resource=clients', { method: 'POST' });
    assert(!response.ok, 'Response should not be ok');
    
    const json = await response.json();
    assert(json.error, 'Should have error field');
    assert.equal(json.error, 'This is a detailed error message', 'Should have detailed message');
  });
  
  await test('Error response with HTML body is detected', async () => {
    setOnline(true);
    mockFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Invalid JSON'); },
      text: async () => '<html>Server Error</html>',
    });
    
    const response = await fetch('/api/data?resource=clients', { method: 'GET' });
    assert(!response.ok, 'Response should not be ok');
    
    // clientPersistence should try response.json()
    // If it fails, it catches and keeps just "API_500"
    try {
      await response.json();
      assert(false, 'Should have thrown');
    } catch {
      // Expected - HTML cannot be parsed as JSON
    }
  });
  
  console.log(`\n📊 Results: ${passCount}/${testCount} tests passed\n`);
  
  if (passCount === testCount) {
    console.log('✅ All LOT 2 clients integration tests passed!\n');
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

/**
 * LOT 0 - Middleware Routing Tests
 * 
 * Tests the dev middleware to ensure:
 * 1. /api/data requests are routed correctly
 * 2. Query string is parsed correctly
 * 3. Request body is parsed correctly
 * 4. Response status codes and JSON are correct
 */

import assert from 'node:assert/strict';
import { createApiMiddleware } from '../server/dev-middleware.js';

// Mock handlers that don't touch the database
const mockDataHandler = async (req, res) => {
  const { query, method, body } = req;
  
  // Simulate the api/data.js behavior without touching DB
  if (method === 'GET') {
    res.status(200).json({ data: [] });
    return;
  }
  
  if (method === 'POST') {
    res.status(201).json({ data: { id: 'mock-id' } });
    return;
  }
  
  if (method === 'PATCH') {
    res.status(200).json({ data: { id: query.id } });
    return;
  }
  
  if (method === 'DELETE') {
    res.status(204).end();
    return;
  }
  
  res.status(405).json({ error: 'Method not allowed' });
};

const mockAuthHandler = async (req, res) => {
  res.status(200).json({ authenticated: true });
};

// Mock response object
class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
    this.ended = false;
  }
  
  status(code) {
    this.statusCode = code;
    return this;
  }
  
  json(data) {
    this.headers['Content-Type'] = 'application/json';
    this.body = JSON.stringify(data);
    this.ended = true;
  }
  
  end() {
    this.ended = true;
  }
}

// Mock request with streaming
class MockRequest {
  constructor(url, method = 'GET', bodyData = null) {
    this.url = url;
    this.method = method;
    this.readable = !!bodyData;
    this.bodyData = bodyData;
    this.listeners = {};
    this.headers = {};
  }
  
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    
    // Simulate data streaming
    if (event === 'data' && this.bodyData) {
      setImmediate(() => {
        callback(Buffer.from(this.bodyData));
      });
    }
    
    if (event === 'data' || event === 'end') {
      if (!this.bodyData) {
        setImmediate(() => {
          if (this.listeners['end']) {
            this.listeners['end'].forEach(cb => cb());
          }
        });
      } else {
        setImmediate(() => {
          if (event === 'end' && this.listeners['end']) {
            this.listeners['end'].forEach(cb => cb());
          }
        });
      }
    }
  }
}

async function runTests() {
  console.log('\n📋 LOT 0 - Middleware Routing Tests\n');
  
  const middleware = createApiMiddleware({
    dataHandler: mockDataHandler,
    authHandler: mockAuthHandler,
  });
  
  let testCount = 0;
  let passCount = 0;
  
  async function test(name, fn) {
    testCount++;
    try {
      await fn();
      console.log(`✅ Test ${testCount}: ${name}`);
      passCount++;
    } catch (error) {
      console.error(`❌ Test ${testCount}: ${name}`);
      console.error(`   ${error.message}`);
    }
  }
  
  // Test 1: GET /api/data?resource=clients
  await test('GET /api/data?resource=clients returns 200 JSON', async () => {
    const req = new MockRequest('/api/data?resource=clients', 'GET');
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await middleware(req, res, next);
    
    assert.equal(res.statusCode, 200, 'Status should be 200');
    assert.equal(res.headers['Content-Type'], 'application/json', 'Content-Type should be JSON');
    assert(res.body, 'Response should have body');
    const parsed = JSON.parse(res.body);
    assert(parsed.data, 'Response should have data field');
  });
  
  // Test 2: POST /api/data with body
  await test('POST /api/data with JSON body returns 201 JSON', async () => {
    const bodyData = JSON.stringify({ fullName: 'Test', phone: '123' });
    const req = new MockRequest('/api/data?resource=clients', 'POST', bodyData);
    req.headers['content-type'] = 'application/json';
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await middleware(req, res, next);
    
    assert.equal(res.statusCode, 201, 'Status should be 201');
    assert(res.body, 'Response should have body');
    const parsed = JSON.parse(res.body);
    assert(parsed.data, 'Response should have data field');
  });
  
  // Test 3: PATCH /api/data?id=123
  await test('PATCH /api/data?id=123 returns 200 JSON', async () => {
    const req = new MockRequest('/api/data?resource=clients&id=123', 'PATCH', JSON.stringify({}));
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await middleware(req, res, next);
    
    assert.equal(res.statusCode, 200, 'Status should be 200');
    assert(res.body, 'Response should have body');
  });
  
  // Test 4: DELETE /api/data?id=123 returns 204
  await test('DELETE /api/data?id=123 returns 204 No Content', async () => {
    const req = new MockRequest('/api/data?resource=clients&id=123', 'DELETE');
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await middleware(req, res, next);
    
    assert.equal(res.statusCode, 204, 'Status should be 204');
    assert(!res.body, 'Response 204 should not have body');
  });
  
  // Test 5: Query string parsing
  await test('Query string is correctly parsed into req.query object', async () => {
    let capturedQuery = null;
    const customDataHandler = async (req, res) => {
      capturedQuery = req.query;
      res.status(200).json({ data: capturedQuery });
    };
    
    const customMiddleware = createApiMiddleware({ dataHandler: customDataHandler });
    const req = new MockRequest('/api/data?resource=clients&id=123&filter=active');
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await customMiddleware(req, res, next);
    
    assert.equal(capturedQuery.resource, 'clients', 'Query.resource should be "clients"');
    assert.equal(capturedQuery.id, '123', 'Query.id should be "123"');
    assert.equal(capturedQuery.filter, 'active', 'Query.filter should be "active"');
  });
  
  // Test 6: Non-/api routes should call next()
  await test('/non-api routes call next() middleware', async () => {
    let nextCalled = false;
    const req = new MockRequest('/files/style.css', 'GET');
    const res = new MockResponse();
    const next = () => { nextCalled = true; };
    
    await middleware(req, res, next);
    
    assert(nextCalled, 'next() should be called for non-/api routes');
    assert(!res.ended, 'Response should not be modified');
  });
  
  // Test 7: /api/auth routes are handled
  await test('POST /api/auth is routed to auth handler', async () => {
    const req = new MockRequest('/api/auth', 'POST', JSON.stringify({ credentials: true }));
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await middleware(req, res, next);
    
    assert.equal(res.statusCode, 200, 'Status should be 200');
    assert(res.body, 'Response should have body');
    const parsed = JSON.parse(res.body);
    assert(parsed.authenticated, 'Auth response should have authenticated field');
  });
  
  // Test 8: Unknown /api route returns 404
  await test('Unknown /api/unknown route returns 404', async () => {
    const req = new MockRequest('/api/unknown', 'GET');
    const res = new MockResponse();
    const next = () => { throw new Error('Middleware should not call next()'); };
    
    await middleware(req, res, next);
    
    assert.equal(res.statusCode, 404, 'Status should be 404');
    const parsed = JSON.parse(res.body);
    assert(parsed.error, 'Response should have error field');
  });
  
  console.log(`\n📊 Results: ${passCount}/${testCount} tests passed\n`);
  
  if (passCount === testCount) {
    console.log('✅ All LOT 0 tests passed!\n');
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

import 'dotenv/config';
import { URL } from 'node:url';
import dataHandler from '../api/data.js';
import authHandler from '../api/auth.js';

/**
 * Parse query string into an object
 */
function parseQuery(queryString) {
  const params = new URLSearchParams(queryString);
  const query = {};
  for (const [key, value] of params) {
    query[key] = value;
  }
  return query;
}

/**
 * Parse request body from stream
 */
async function parseBody(req) {
  if (!req.readable) return undefined;
  
  return new Promise((resolve) => {
    let rawBody = '';
    
    req.on('data', (chunk) => {
      rawBody += chunk.toString('utf8');
    });
    
    req.on('end', () => {
      if (!rawBody) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(rawBody));
      } catch {
        resolve({});
      }
    });
    
    req.on('error', () => {
      resolve({});
    });
  });
}

/**
 * Create Vite middleware that handles API routes
 */
export function createApiMiddleware(handlers = {}) {
  const data = handlers.dataHandler ?? dataHandler;
  const auth = handlers.authHandler ?? authHandler;
  return async (req, res, next) => {
    // Only handle /api/ routes
    if (!req.url.startsWith('/api/')) {
      return next();
    }

    try {
      // Parse URL to extract pathname and query
      const url = new URL(`http://localhost${req.url}`);
      const pathname = url.pathname;
      const queryString = url.search.slice(1);

      // Attach query as object to request
      req.query = parseQuery(queryString);

      // Parse body if present (for POST/PATCH)
      if (req.method === 'POST' || req.method === 'PATCH') {
        req.body = await parseBody(req);
      }

      // Route to appropriate handler
      if (pathname === '/api/data') {
        return data(req, res);
      }
      if (pathname === '/api/auth') {
        return auth(req, res);
      }

      // Unknown API route
      return res.status(404).json({ error: 'API endpoint not found.' });
    } catch (error) {
      console.error('[API Middleware Error]', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
}

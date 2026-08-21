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

    // Polyfill Express/Vercel helper methods on native Node http.ServerResponse
    if (!res.status) {
      res.status = function (statusCode) {
        this.statusCode = statusCode;
        return this;
      };
    }
    if (!res.json) {
      res.json = function (data) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8');
        this.end(JSON.stringify(data));
        return this;
      };
    }
    if (!res.send) {
      res.send = function (data) {
        if (typeof data === 'object') {
          return this.json(data);
        }
        this.end(data);
        return this;
      };
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
        return await data(req, res);
      }
      if (pathname === '/api/auth') {
        return await auth(req, res);
      }

      // Unknown API route
      return res.status(404).json({ error: 'API endpoint not found.' });
    } catch (error) {
      console.error('[API Middleware Error]', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
}

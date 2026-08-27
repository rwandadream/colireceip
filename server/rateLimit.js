// Best-effort login rate limiting for the serverless API.
//
// LIMITATION: In Vercel's serverless model each lambda instance has its own
// heap, so this in-memory counter is PER-INSTANCE and resets on cold starts or
// when the request lands on a different instance. It is a deterrent against
// casual brute-force attempts, NOT a hard guarantee.
//
// Production hardening: move the counters to a shared store (Vercel KV /
// Upstash Redis) keyed by normalized identifier and client IP, and combine
// with per-account lockout persisted in PostgreSQL.

const WINDOW_MS = Number(process.env.LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000);
const MAX_IDENTIFIER_FAILURES = Number(process.env.LOGIN_MAX_FAILURES_IDENTIFIER || 5);
const MAX_IP_FAILURES = Number(process.env.LOGIN_MAX_FAILURES_IP || 20);

const state = new Map(); // key -> { count, firstAt }

const keyFor = (type, value) => `${type}:${String(value ?? '').toLowerCase()}`;

function snapshot(key, now) {
  const entry = state.get(key);
  if (!entry) return { count: 0, firstAt: now };
  if (now - entry.firstAt >= WINDOW_MS) {
    state.delete(key);
    return { count: 0, firstAt: now };
  }
  return entry;
}

function evictExpired(now) {
  if (state.size < 10000) return;
  for (const [key, entry] of state) {
    if (now - entry.firstAt >= WINDOW_MS) state.delete(key);
  }
}

export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// Returns seconds remaining before the lock expires (0 = not blocked).
export function checkLoginRateLimit(identifier, ip) {
  const now = Date.now();
  const identifierSnapshot = snapshot(keyFor('identifier', identifier), now);
  if (identifierSnapshot.count >= MAX_IDENTIFIER_FAILURES) {
    return Math.ceil((identifierSnapshot.firstAt + WINDOW_MS - now) / 1000);
  }
  const ipSnapshot = snapshot(keyFor('ip', ip), now);
  if (ipSnapshot.count >= MAX_IP_FAILURES) {
    return Math.ceil((ipSnapshot.firstAt + WINDOW_MS - now) / 1000);
  }
  return 0;
}

export function recordLoginFailure(identifier, ip) {
  const now = Date.now();
  for (const key of [keyFor('identifier', identifier), keyFor('ip', ip)]) {
    const snap = snapshot(key, now);
    state.set(key, { count: snap.count + 1, firstAt: snap.firstAt });
  }
  evictExpired(now);
}

export function recordLoginSuccess(identifier) {
  state.delete(keyFor('identifier', identifier));
}
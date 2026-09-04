import 'dotenv/config';
import { requireAuthenticatedUser } from '../server/auth.js';
import { create, list, remove, update } from '../server/data.js';

const body = (req) => { if (req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req.body || '{}'); } catch { return {}; } };

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------
// Unexpected backend/database/driver failures are transient by nature: the
// request is well-formed and would succeed once the connection recovers. They
// must surface as HTTP 503 (retryable) instead of the generic 400 catch-all,
// otherwise a single infrastructure hiccup permanently fails a queued mutation
// and sticks it in the UI's failed state forever.
const TRANSIENT_PRISMA_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1004', 'P1008', 'P1017', 'P2024']);
const TRANSIENT_NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNABORTED', 'ENETDOWN']);
// PostgreSQL connection-exception class (08xxx), "cannot connect" states, and
// statement/lock/serialization failures (57014, 40001, 55P03, 40P01).
const TRANSIENT_SQLSTATE = /^08/;
const TRANSIENT_SQLSTATE_CODES = new Set(['57P01', '57P02', '57P03', '53300', '57014', '40001', '55P03', '40P01']);

export function isTransientServiceError(error) {
  if (!(error instanceof Error)) return false;
  const code = typeof error.code === 'string' ? error.code : '';
  return TRANSIENT_PRISMA_CODES.has(code)
    || TRANSIENT_NETWORK_CODES.has(code)
    || TRANSIENT_SQLSTATE.test(code)
    || TRANSIENT_SQLSTATE_CODES.has(code);
}

// Kept separate from the handler so the HTTP contract can be unit-tested
// without a live database. Contract for every resource:
//   Forbidden -> 403 ; conflicts -> 409 ; client/validation -> 400 ;
//   missing config / write-conflict / transient infra -> 503.
// A foreign-key violation surfaces as P2003 (classic Prisma) or, with the pg
// driver adapter, as P2039 whose underlying Postgres code is 23001/23503
// (RESTRICT/NO ACTION delete). Both mean the row is referenced and cannot be
// deleted -> an HTTP 409 "conflict".
const FK_VIOLATION = (error) => error.code === 'P2003'
  || error.code === 'P2039'
  || /(update or )?delete on table .*violates RESTRICT|violates foreign key constraint|not present in table "parent"/i.test(error.message || '');

export function classifyApiErrorStatus(error) {
  return error.message === 'Forbidden.' ? 403
    : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'DUPLICATE_PHONE' || error.code === 'P2002' || FK_VIOLATION(error) || error.code === 'STATUS_CONFLICT' || error.code === 'TRIP_HAS_LINKED_DATA' ? 409
    : error.code === 'MISSING_IDEMPOTENCY_KEY' ? 400
    : error.code === 'REQUIRED_CONFIG_MISSING' || error.code === 'P2034' || error.message?.startsWith('Required server configuration') ? 503
    : isTransientServiceError(error) ? 503
    : 400;
}

export default async function handler(req, res) {
  const user = await requireAuthenticatedUser(req); if (!user) return res.status(401).json({ error: 'Non authentifié.' });
  const resource = req.query.resource;
  try {
    if (req.method === 'GET') return res.status(200).json({ data: await list(resource, user, req.query) });
    if (req.method === 'POST') {
      const header = req.headers['idempotency-key'];
      const idempotencyKey = Array.isArray(header) ? header[0] : header;
      return res.status(201).json({ data: await create(resource, body(req), user, { idempotencyKey }) });
    }
    if (req.method === 'PATCH') return res.status(200).json({ data: await update(resource, String(req.query.id || ''), body(req), user) });
    if (req.method === 'DELETE') { await remove(resource, String(req.query.id || ''), user); return res.status(204).end(); }
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (error) {
    console.error('Error in /api/data handler:', error);
    const status = classifyApiErrorStatus(error);
    // A missing-dependency 400 (the referenced client/trip/parent does not
    // exist server-side yet) is a sequencing problem, not a permanent one: the
    // sync engine must be able to tell it apart from a genuine validation
    // error so it can retry once the dependency has been synced. Preserve the
    // specific server message in that case; every other 400 stays generic.
    const isMissingDependency = /introuvable|Missing/i.test(error.message || '');
    const message = status === 403 ? 'Accès refusé.'
      : status === 409 ? error.code === 'TRIP_HAS_LINKED_DATA' ? 'Suppression impossible : des données liées existent.' : error.code === 'P2003' || error.code === 'P2039' ? 'Suppression impossible : des données liées existent.' : error.code === 'STATUS_CONFLICT' ? 'Conflit de statut : le colis a été modifié sur le serveur.' : error.code === 'DUPLICATE_PHONE' ? error.message : 'Conflit d\'idempotence.'
      : status === 503 ? 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
      : error.code === 'TRIP_CANCELLED' ? error.message
      : error.code === 'MISSING_IDEMPOTENCY_KEY' ? 'En-tête Idempotency-Key requis.'
      : isMissingDependency ? error.message
      : 'Requête invalide. Vérifiez les champs saisies.';
    return res.status(status).json({ error: message });
  }
}

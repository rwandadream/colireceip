import 'dotenv/config';
import { requireAuthenticatedUser } from '../server/auth.js';
import { create, list, remove, update } from '../server/data.js';

const body = (req) => { if (req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req.body || '{}'); } catch { return {}; } };
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
    const status = error.message === 'Forbidden.' ? 403 : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'P2002' ? 409 : error.code === 'MISSING_IDEMPOTENCY_KEY' ? 400 : 400;
    const message = status === 403 ? 'Accès refusé.' : status === 409 ? 'Conflit d\'idempotence.' : error.code === 'MISSING_IDEMPOTENCY_KEY' ? 'En-tête Idempotency-Key requis.' : 'Requête invalide.';
    return res.status(status).json({ error: message });
  }
}

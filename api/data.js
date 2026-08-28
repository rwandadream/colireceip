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
    console.error('Error in /api/data handler:', error);
    const status = error.message === 'Forbidden.' ? 403
      : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'P2002' || error.code === 'P2003' || error.code === 'STATUS_CONFLICT' ? 409
      : error.code === 'MISSING_IDEMPOTENCY_KEY' ? 400
      : error.code === 'REQUIRED_CONFIG_MISSING' || error.code === 'P2034' || error.message?.startsWith('Required server configuration') ? 503
      : 400;
    const message = status === 403 ? 'Accès refusé.'
      : status === 409 ? error.code === 'P2003' ? 'Suppression impossible : des données liées existent.' : error.code === 'STATUS_CONFLICT' ? 'Conflit de statut : le colis a été modifié sur le serveur.' : 'Conflit d\'idempotence.'
      : status === 503 ? 'Le service est temporairement indisponible (configuration serveur manquante).'
      : error.code === 'MISSING_IDEMPOTENCY_KEY' ? 'En-tête Idempotency-Key requis.'
      : 'Requête invalide. Vérifiez les champs saisies.';
    return res.status(status).json({ error: message });
  }
}

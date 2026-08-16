import 'dotenv/config';
import { authenticate, clearSessionCookie, createSessionToken, requireAuthenticatedUser, setSessionCookie } from '../server/auth.js';

function body(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body !== 'string') return {};
  try { return JSON.parse(req.body); } catch { return {}; }
}

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    if (req.method === 'POST' && action === 'login') {
      const { identifier, password } = body(req);
      const user = await authenticate(identifier, password);
      if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });
      setSessionCookie(res, createSessionToken(user));
      return res.status(200).json({ user });
    }
    if (req.method === 'POST' && action === 'logout') {
      clearSessionCookie(res);
      return res.status(204).end();
    }
    if (req.method === 'GET' && action === 'me') {
      const user = await requireAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Non authentifié.' });
      return res.status(200).json({ user });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch {
    return res.status(500).json({ error: 'Une erreur serveur est survenue.' });
  }
}

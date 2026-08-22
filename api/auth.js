import 'dotenv/config';
import { authenticate, clearSessionCookie, createSessionToken, requireAuthenticatedUser, setSessionCookie } from '../server/auth.js';

function body(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  const action = req.query?.action || (req.url ? new URL(req.url, 'http://localhost').searchParams.get('action') : undefined);
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
  } catch (error) {
    console.error('Error in /api/auth handler:', error);
    return res.status(500).json({ error: error?.message || 'Une erreur serveur est survenue.' });
  }
}

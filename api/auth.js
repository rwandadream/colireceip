import 'dotenv/config';
import { authenticate, clearSessionCookie, createSessionToken, requireAuthenticatedUser, setSessionCookie } from '../server/auth.js';
import { checkLoginRateLimit, clientIp, recordLoginFailure, recordLoginSuccess } from '../server/rateLimit.js';

const isConfigurationError = (error) => error?.code === 'REQUIRED_CONFIG_MISSING' || error?.message?.startsWith('Required server configuration');

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
      if (typeof identifier !== 'string' || !identifier.trim()) {
        return res.status(400).json({ error: 'Identifiant requis.' });
      }
      const ip = clientIp(req);
      const retryAfter = checkLoginRateLimit(identifier, ip);
      if (retryAfter > 0) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'Trop de tentatives de connexion. Réessayez plus tard.' });
      }
      const user = await authenticate(identifier, password);
      if (!user) {
        recordLoginFailure(identifier, ip);
        return res.status(401).json({ error: 'Identifiants invalides.' });
      }
      recordLoginSuccess(identifier);
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
    const status = isConfigurationError(error) ? 503 : 500;
    const message = status === 503
      ? 'Le service est temporairement indisponible (configuration serveur manquante).'
      : 'Une erreur serveur est survenue.';
    return res.status(status).json({ error: message });
  }
}

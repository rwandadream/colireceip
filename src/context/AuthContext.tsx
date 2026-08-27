/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { User } from '../lib/types';
import { getUserByEmail, logActivity, ensureSeed } from '../lib/data';
import { AUTH_STORAGE_KEYS, clearStorageKeys, readStorageJson, writeStorageJson } from '../lib/storage';
import { getDB } from '../lib/db';
import { storeUserVerifier, verifyOfflinePassword } from '../lib/authVerifier';
import { ApiError, fetchWithTimeout, isTransientApiError } from '../lib/api';

const API_UNAVAILABLE_MSG = 'Authentication API is unavailable.';

async function requestServerSession(): Promise<User | null> {
  let response: Response;
  try {
    response = await fetchWithTimeout('/api/auth?action=me', { credentials: 'same-origin' });
  } catch {
    throw new Error(API_UNAVAILABLE_MSG);
  }
  if ([404, 405].includes(response.status) || isTransientApiError(new ApiError(response.status, ''))) {
    throw new Error(API_UNAVAILABLE_MSG);
  }
  if (response.status === 401) return null;
  if (!response.ok) return null;
  const payload = await response.json() as { user?: User };
  return payload.user ?? null;
}

async function cacheAuthenticatedUser(authUser: User): Promise<void> {
  const db = await getDB();
  const existing = await db.get('users', authUser.id);
  if (existing) {
    await db.put('users', { ...existing, ...authUser, updated_at: authUser.updated_at || existing.updated_at });
  } else {
    await db.put('users', authUser);
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await ensureSeed();
      } catch (err) {
        console.error('Database initialization error:', err);
      }

      if (!active) return;

      let parsedUser = readStorageJson<User>(AUTH_STORAGE_KEYS);
      if (navigator.onLine) {
        try {
          parsedUser = await requestServerSession();
          if (parsedUser) await cacheAuthenticatedUser(parsedUser);
        } catch {
          // Vite without the serverless API and temporary network outages keep the local session usable.
        }
      }
      if (parsedUser && active) {
        setUser(parsedUser);
        writeStorageJson('groupe-gaff-auth', parsedUser);
      } else if (!parsedUser && active) {
        clearStorageKeys(AUTH_STORAGE_KEYS);
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    if (navigator.onLine) {
      try {
        const response = await fetchWithTimeout('/api/auth?action=login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        if ([404, 405].includes(response.status)) {
          throw new Error(API_UNAVAILABLE_MSG);
        }
        if (isTransientApiError(new ApiError(response.status, ''))) {
          throw new Error(API_UNAVAILABLE_MSG);
        }
        if (response.status === 401) return { ok: false, error: 'Identifiants invalides' };
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const hint = retryAfter ? ` Réessayez dans ${retryAfter}s.` : '';
          return { ok: false, error: `Trop de tentatives de connexion.${hint}` };
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null;
          return { ok: false, error: payload?.error || 'Erreur de connexion' };
        }
        const payload = await response.json() as { user?: User };
        if (!payload.user) return { ok: false, error: 'Erreur de connexion' };
        setUser(payload.user);
        writeStorageJson('groupe-gaff-auth', payload.user);
        await cacheAuthenticatedUser(payload.user);
        await storeUserVerifier(payload.user, password).catch(() => undefined);
        return { ok: true };
      } catch {
        // The offline-first application remains usable with its IndexedDB account store.
      }
    }

    const u = await getUserByEmail(identifier);
    if (!u) return { ok: false, error: 'Utilisateur introuvable' };
    if (!u.active) return { ok: false, error: 'Compte désactivé. Contactez l\'administrateur.' };
    const valid = await verifyOfflinePassword(identifier, password);
    if (!valid) return { ok: false, error: 'Mot de passe incorrect' };

    setUser(u);
    writeStorageJson('groupe-gaff-auth', u);
    await logActivity(u.id, u.full_name, 'Connexion', 'user', u.id, `Connexion de ${u.full_name}`);
    return { ok: true };
  };

  const logout = () => {
    if (navigator.onLine) {
      void fetch('/api/auth?action=logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    }
    if (user) {
      logActivity(user.id, user.full_name, 'Déconnexion', 'user', user.id, '');
    }
    setUser(null);
    clearStorageKeys(AUTH_STORAGE_KEYS);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

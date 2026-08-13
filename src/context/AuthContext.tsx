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

      const parsedUser = readStorageJson<User>(AUTH_STORAGE_KEYS);
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
    const u = await getUserByEmail(identifier);
    if (!u) return { ok: false, error: 'Utilisateur introuvable' };
    if (!u.active) return { ok: false, error: 'Compte désactivé. Contactez l\'administrateur.' };
    if (u.password !== password) return { ok: false, error: 'Mot de passe incorrect' };

    setUser(u);
    writeStorageJson('groupe-gaff-auth', u);
    await logActivity(u.id, u.full_name, 'Connexion', 'user', u.id, `Connexion de ${u.full_name}`);
    return { ok: true };
  };

  const logout = () => {
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

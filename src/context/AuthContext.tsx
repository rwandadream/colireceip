import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { User } from '../lib/types';
import { getUserByEmail, logActivity, ensureSeed } from '../lib/data';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = 'sarah-groupe-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await ensureSeed();
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const u = await getUserByEmail(email);
    if (!u) return { ok: false, error: 'Utilisateur introuvable' };
    if (!u.active) return { ok: false, error: 'Compte désactivé. Contactez l\'administrateur.' };
    if (u.password !== password) return { ok: false, error: 'Mot de passe incorrect' };

    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    await logActivity(u.id, u.full_name, 'Connexion', 'user', u.id, `Connexion de ${u.full_name}`);
    return { ok: true };
  };

  const logout = () => {
    if (user) {
      logActivity(user.id, user.full_name, 'Déconnexion', 'user', user.id, '');
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
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

import { useState } from 'react';
import { Truck, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (!result.ok) {
      setError(result.error || 'Erreur de connexion');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xl mb-4">
            <Truck size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transit Mali CI</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestion de colis Bamako → Abidjan
          </p>
        </div>

        <div className="card p-6 sm:p-8 animate-slide-up">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Connexion</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Connectez-vous à votre compte
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 text-sm animate-fade-in">
              <AlertCircle size={18} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Adresse email"
              type="email"
              placeholder="admin@transitmali.ci"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={18} />}
              required
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock size={18} />}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Se connecter
            </Button>
          </form>

          <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Compte de démonstration:
            </p>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center mt-1">
              admin@transitmali.ci / admin123
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Transit Mali CI — Fonctionne hors connexion
        </p>
      </div>
    </div>
  );
}

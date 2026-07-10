import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthLayout } from '../components/layout/AuthLayout';

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
    <AuthLayout>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-xl mb-4">
          <Mail size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Envoyez vos colis simplement</h1>
        <p className="text-sm text-slate-500 mt-1">Suivez vos livraisons en temps réel.</p>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Connexion</h2>
        <p className="text-sm text-slate-500 mb-4">Accédez à votre espace de gestion des expéditions.</p>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-error-50 text-error-700 text-sm">
            <AlertCircle size={18} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Adresse email"
            type="email"
            placeholder="vous@exemple.com"
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
              className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Button type="submit" loading={loading} className="w-full btn-accent" size="lg">
            Se connecter
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <div className="text-xs text-slate-400">ou</div>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <button type="button" className="btn bg-white border border-slate-200 w-full flex items-center justify-center gap-2 text-slate-700 hover:shadow-sm">
            <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M44.5 20H24v8.5h11.9C34.6 32.8 30.8 36 24 36c-7.8 0-14-6.2-14-14s6.2-14 14-14c3.8 0 6.9 1.4 9.2 3.6l6.6-6.6C34.8 2.8 29.7 0 24 0 10.7 0 0 10.7 0 24s10.7 24 24 24c12.4 0 23-9.2 23.9-21H44.5z" fill="#4285F4"/>
            </svg>
            Continuer avec Google
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <a href="/signup" className="text-brand-600 font-medium hover:underline">Créer un compte</a>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
          <div>Compte de démonstration: <span className="font-medium text-slate-700">admin@demo / admin123</span></div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">Application de gestion de colis — Rapide & sécurisée</p>
    </AuthLayout>
  );
}

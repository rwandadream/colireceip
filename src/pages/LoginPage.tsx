import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SarahGroupeLogo } from '../components/ui/SarahGroupeLogo';
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
    }
    setLoading(false);
  };

  return (
    <AuthLayout>
      <div className="space-y-10">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[#2563EB]/10 text-[#2563EB] shadow-[0_20px_40px_-20px_rgba(37,99,235,0.5)]">
            <SarahGroupeLogo className="h-8 w-8" />
          </div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Sarah-Groupe</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">Bienvenue !</h1>
          <p className="mt-3 text-sm text-slate-500">Connectez-vous à votre espace pour continuer.</p>
        </div>

        <div className="space-y-6 rounded-[32px] border border-slate-200/70 bg-white p-8 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.15)]">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#F97316]/20 bg-[#F97316]/10 px-4 py-3 text-sm text-[#B45309]">
              <AlertCircle size={18} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
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
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full btn-accent" size="lg">
              Se connecter
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">© 2025 Sarah-Groupe. Tous droits réservés.</p>
      </div>
    </AuthLayout>
  );
}

import { useState } from 'react';
import { Phone, Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LogoBrand } from '../components/ui/Logo';

export function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(identifier, password);
    if (!result.ok) {
      setError(result.error || 'Erreur de connexion');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="w-full max-w-md space-y-6">
        
        {/* Centered Logo & Welcome Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <LogoBrand size={46} subtitle="Livraison rapide et sécurisée" className="justify-center" />
          
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Bienvenue !
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connectez-vous à votre espace
              <br />
              pour continuer
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl space-y-5 animate-slide-up">
          
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-error-50 dark:bg-error-950/20 text-error-700 dark:text-error-400 text-sm animate-fade-in border border-error-100 dark:border-error-900/30">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail ou téléphone"
              type="text"
              placeholder="+223 70 00 00 00"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              icon={<Phone size={18} />}
              required
              autoComplete="username"
            />

            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock size={18} />}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9.5 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end text-xs">
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Veuillez contacter votre administrateur pour réinitialiser votre mot de passe.');
                }}
                className="font-semibold text-[#2563EB] dark:text-brand-400 hover:underline"
              >
                Mot de passe oublié ?
              </a>
            </div>

            <Button
              type="submit"
              loading={loading}
              variant="ghost"
              className="w-full mt-4 bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-3 font-semibold rounded-xl text-base shadow-md hover:shadow-lg focus:ring-2 focus:ring-orange-500/20 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2"
              icon={<LogIn size={18} />}
            >
              Se connecter
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
          © 2025 Groupe-Gaff. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import {
  Save,
  Building2,
  DollarSign,
  User,
  LogIn,
  LogOut,
  Trash2,
  Edit,
  Plus,
  Package,
  Wallet,
  Users,
  Settings,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSettings, updateSettings, logActivity, getActivityLogs } from '../lib/data';
import type { AppSettings, ActivityLog } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Badge';
import { timeAgo } from '../lib/format';

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const [s, l] = await Promise.all([
        getSettings(),
        getActivityLogs(10),
      ]);

      if (!active) return;
      setSettings(s);
      setRecentLogs(l);
      setLoading(false);
    })();

    return () => {
      active = false;
      if (savedTimeoutRef.current) {
        window.clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await updateSettings(settings);
    await logActivity(user?.id || '', user?.full_name || '', 'a modifié les paramètres de l\'application', 'settings', '', '');
    setSaving(false);
    setSaved(true);
    if (savedTimeoutRef.current) {
      window.clearTimeout(savedTimeoutRef.current);
    }
    savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2000);
  };

  // Function to return activity timeline icon and color
  const getActivityStyle = (entityType: string, action: string) => {
    const act = action.toLowerCase();
    if (act.includes('connexion')) {
      return {
        icon: <LogIn size={16} />,
        bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-100 dark:border-indigo-900/30'
      };
    }
    if (act.includes('déconnexion')) {
      return {
        icon: <LogOut size={16} />,
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-700'
      };
    }
    if (act.includes('supprimé') || act.includes('désactivé')) {
      return {
        icon: <Trash2 size={16} />,
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
        border: 'border-rose-100 dark:border-rose-900/30'
      };
    }
    if (act.includes('créé') || act.includes('ajouté')) {
      return {
        icon: <Plus size={16} />,
        bg: 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
        border: 'border-brand-100 dark:border-brand-900/30'
      };
    }
    if (act.includes('statut') || act.includes('modifié')) {
      return {
        icon: <Edit size={16} />,
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
        border: 'border-amber-100 dark:border-amber-900/30'
      };
    }

    switch (entityType) {
      case 'parcel':
        return {
          icon: <Package size={16} />,
          bg: 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
          border: 'border-brand-100 dark:border-brand-900/30'
        };
      case 'payment':
        return {
          icon: <Wallet size={16} />,
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-100 dark:border-emerald-900/30'
        };
      case 'client':
        return {
          icon: <Users size={16} />,
          bg: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
          border: 'border-purple-100 dark:border-purple-900/30'
        };
      case 'user':
        return {
          icon: <User size={16} />,
          bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400',
          border: 'border-orange-100 dark:border-orange-900/30'
        };
      case 'settings':
        return {
          icon: <Settings size={16} />,
          bg: 'bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400',
          border: 'border-slate-100 dark:border-slate-805'
        };
      default:
        return {
          icon: <Package size={16} />,
          bg: 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
          border: 'border-brand-100 dark:border-brand-900/30'
        };
    }
  };

  if (loading || !settings) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configuration de l'application et préférences</p>
      </div>

      {/* Profil & Préférences Card */}
      <Card className="p-5">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <User size={18} />
          Profil & Préférences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-lg">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role === 'admin' ? 'Directeur' : 'Agent'}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{user?.phone}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mode Sombre</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Activer le thème sombre de l'application</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6.5 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                theme === 'dark' ? 'bg-[#2563EB]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform duration-300 ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1.5'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 size={18} />
          Informations de l'entreprise
        </h2>
        <div className="space-y-4">
          <Input
            label="Nom de l'entreprise"
            value={settings.company_name}
            onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Téléphone"
              value={settings.company_phone}
              onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={settings.company_email}
              onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
            />
          </div>
          <Input
            label="Adresse Bamako"
            value={settings.bamako_address}
            onChange={(e) => setSettings({ ...settings, bamako_address: e.target.value })}
          />
          <Input
            label="Adresse Abidjan"
            value={settings.abidjan_address}
            onChange={(e) => setSettings({ ...settings, abidjan_address: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign size={18} />
          Paramètres financiers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Prix de transport par défaut (FCFA)"
            type="number"
            value={settings.default_transport_price === 0 ? '' : settings.default_transport_price}
            onChange={(e) => setSettings({ ...settings, default_transport_price: e.target.value === '' ? 0 : Number(e.target.value) })}
          />
          <Input
            label="Devise"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 size={18} />
          Transit & Trajet par défaut
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Origine par défaut"
            value={settings.default_origin || ''}
            onChange={(e) => setSettings({ ...settings, default_origin: e.target.value })}
          />
          <Input
            label="Destination par défaut"
            value={settings.default_destination || ''}
            onChange={(e) => setSettings({ ...settings, default_destination: e.target.value })}
          />
        </div>
      </Card>

      {/* Activity Log Card */}
      <Card className="p-5 flex flex-col">
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings size={18} />
              Activité récente
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Flux d'événements en direct de l'application</p>
          </div>
          {user?.role === 'admin' && (
            <Link to="/logs" className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/40 flex items-center gap-1.5 transition-all">
              Voir tout <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="text-slate-300 dark:text-slate-700 mb-2" size={32} />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aucune activité enregistrée
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4">
            {/* Vertical timeline connector line */}
            <div className="absolute left-3 top-2 bottom-2 w-[1.5px] bg-slate-200 dark:bg-slate-800" />

            {recentLogs.map((log) => {
              const style = getActivityStyle(log.entity_type, log.action);
              return (
                <div key={log.id} className="relative group">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[23px] top-1 w-6 h-6 rounded-full border-2 bg-white dark:bg-slate-900 ${style.border} flex items-center justify-center shadow-sm z-10 transition-transform duration-300 group-hover:scale-110`}>
                    <span className="scale-90">{style.icon}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Par <span className="font-semibold text-slate-700 dark:text-slate-300">{log.user_name}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {timeAgo(log.created_at)}
                      </p>
                    </div>

                    <p className="text-sm text-slate-805 dark:text-slate-205 font-bold leading-snug">
                      {log.action}
                    </p>

                    {log.details && (
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100/50 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3 pb-4">
        <Button onClick={handleSave} loading={saving}>
          <Save size={18} />
          Enregistrer
        </Button>
        {saved && (
          <span className="text-sm text-success-600 dark:text-success-400 animate-fade-in">
            Paramètres enregistrés ✓
          </span>
        )}
      </div>
    </div>
  );
}

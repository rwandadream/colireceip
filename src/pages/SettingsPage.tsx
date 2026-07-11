import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, Building2, DollarSign } from 'lucide-react';
import { getSettings, updateSettings, logActivity } from '../lib/data';
import type { AppSettings } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Badge';

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await updateSettings(settings);
    await logActivity(user?.id || '', user?.full_name || '', 'a modifié les paramètres de l\'application', 'settings', '', '');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Paramètres"
        description="Ajustez les informations de l'entreprise et la configuration financière de votre plateforme"
      />

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
            value={settings.default_transport_price}
            onChange={(e) => setSettings({ ...settings, default_transport_price: Number(e.target.value) })}
          />
          <Input
            label="Devise"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Journal des actions</h2>
            <p className="mt-2 text-sm text-slate-500">Accédez aux événements opérationnels et au suivi des activités depuis les paramètres.</p>
          </div>
          <Link
            to="/logs"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition"
          >
            Voir le journal
          </Link>
        </div>
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

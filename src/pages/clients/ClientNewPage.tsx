import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { createClient, getClients, logActivity } from '../../lib/data';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import type { Client } from '../../lib/types';

const INITIAL_FORM = {
  full_name: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function ClientNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    (async () => {
      try {
        setClients(await getClients());
      } catch (error) {
        const message = error instanceof Error && error.message
          ? error.message
          : 'Impossible de charger les clients pour le moment.';
        addToast({
          type: 'error',
          title: 'Erreur de chargement',
          description: message,
        });
      }
    })();
  }, [addToast]);

  useEffect(() => {
    const search = normalizeText(form.full_name || form.phone || '');
    if (!search) {
      setSuggestions([]);
      return;
    }

    const matches = clients.filter((client) => {
      const samePhone = form.phone && client.phone && normalizeText(client.phone) === normalizeText(form.phone);
      const sameName = normalizeText(client.full_name).includes(search) || search.includes(normalizeText(client.full_name));
      return samePhone || sameName;
    }).slice(0, 4);

    setSuggestions(matches);
  }, [clients, form.full_name, form.phone]);

  const handleSuggestionSelect = (client: Client) => {
    setForm({
      full_name: client.full_name,
      phone: client.phone || '',
      city: client.city || '',
      address: client.address || '',
      notes: client.notes || '',
    });
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) return;

    const existing = clients.find((client) => {
      const samePhone = form.phone && client.phone && normalizeText(client.phone) === normalizeText(form.phone);
      const sameName = normalizeText(client.full_name) === normalizeText(form.full_name);
      return samePhone || sameName;
    });

    if (existing) {
      navigate(`/clients/${existing.id}`);
      return;
    }

    setSaving(true);
    try {
      const client = await createClient({
        ...form,
        created_by: user?.id || '',
        created_by_name: user?.full_name || '',
      });
      await logActivity(user?.id || '', user?.full_name || '', `a créé le client ${client.full_name}`, 'client', client.id, '').catch(() => undefined);
      addToast({
        type: 'success',
        title: 'Client créé',
        description: `Le client ${client.full_name} a été créé avec succès.`,
      });
      navigate(`/clients/${client.id}`);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Impossible de créer ce client pour le moment.';
      addToast({
        type: 'error',
        title: 'Erreur de création',
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau client</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ajoutez un client rapidement et évitez les doublons.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-5 space-y-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles size={16} />
              <span>Si le client existe déjà, nous vous le suggérons automatiquement.</span>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Clients similaires</p>
              <div className="space-y-2">
                {suggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSuggestionSelect(client)}
                    className="flex w-full items-start justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span>
                      <span className="font-semibold">{client.full_name}</span>
                      {client.company_name ? ` · ${client.company_name}` : ''}
                    </span>
                    <span className="text-xs text-slate-400">{client.phone || client.city}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nom complet *"
              placeholder="Ex: Moussa Traoré"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
            <Input
              label="Téléphone"
              placeholder="+223 ..."
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Ville"
              placeholder="Bamako, Abidjan..."
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Link to="/clients" className="btn-secondary">Annuler</Link>
            <Button type="submit" loading={saving}>
              <Save size={18} />
              Enregistrer
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

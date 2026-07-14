import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { createClient, logActivity } from '../../lib/data';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ClientNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    city: '',
    address: '',
    notes: '',
  });
       // whatsapp removed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) return;
    setSaving(true);
    const client = await createClient({
      ...form,
      created_by: user?.id || '',
      created_by_name: user?.full_name || '',
    });
    await logActivity(user?.id || '', user?.full_name || '', `a créé le client ${client.full_name}`, 'client', client.id, '');
    navigate(`/clients/${client.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau client</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ajouter un nouveau client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-5 space-y-4">
          <Input
            label="Nom complet *"
            placeholder="Ex: Moussa Traoré"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Téléphone"
              placeholder="+223 ..."
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
              {/* WhatsApp removed: only phone is required */}
          </div>
          <Input
            label="Ville"
            placeholder="Bamako, Abidjan..."
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <Input
            label="Adresse"
            placeholder="Quartier, rue, etc."
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Textarea
            label="Notes"
            rows={2}
            placeholder="Informations supplémentaires..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
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

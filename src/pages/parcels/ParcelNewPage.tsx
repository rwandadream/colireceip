import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, UserPlus, Save } from 'lucide-react';
import { getClients, createParcel, logActivity, getSettings } from '../../lib/data';
import type { Client } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../lib/format';
import { createClient } from '../../lib/data';

export function ParcelNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);

  const [form, setForm] = useState({
    client_id: '',
    merchandise_type: '',
    description: '',
    quantity: 1 as string | number,
    weight: '' as string | number,
    transport_price: '' as string | number,
    additional_fees: '' as string | number,
    amount_paid: '' as string | number,
    origin: '',
    destination: '',
  });

  const [newClient, setNewClient] = useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    city: '',
    address: '',
  });

  useEffect(() => {
    (async () => {
      const [clientsData, appSettings] = await Promise.all([
        getClients(),
        getSettings(),
      ]);
      setClients(clientsData);
      if (appSettings) {
        setForm((prev) => ({
          ...prev,
          transport_price: appSettings.default_transport_price || 5000,
          origin: appSettings.default_origin || 'Bamako',
          destination: appSettings.default_destination || 'Abidjan',
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          transport_price: 5000,
          origin: 'Bamako',
          destination: 'Abidjan',
        }));
      }
      setLoading(false);
    })();
  }, []);

  const transportPriceNum = Number(form.transport_price) || 0;
  const additionalFeesNum = Number(form.additional_fees) || 0;
  const amountPaidNum = Number(form.amount_paid) || 0;

  const total = transportPriceNum + additionalFeesNum;
  const balance = total - amountPaidNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return;
    setSaving(true);
    const client = clients.find((c) => c.id === form.client_id);
    const parcel = await createParcel({
      client_id: form.client_id,
      client_name: client?.full_name || '',
      client_phone: client?.phone || '',
      merchandise_type: form.merchandise_type,
      description: form.description,
      quantity: Number(form.quantity),
      weight: Number(form.weight),
      transport_price: Number(form.transport_price),
      additional_fees: Number(form.additional_fees),
      amount_paid: Number(form.amount_paid),
      status: 'received',
      origin: form.origin,
      destination: form.destination,
      received_date: new Date().toISOString(),
      departure_date: null,
      arrival_date: null,
      delivery_date: null,
      registered_by: user?.id || '',
      registered_by_name: user?.full_name || '',
    });
    await logActivity(
      user?.id || '',
      user?.full_name || '',
      `a créé le colis ${parcel.tracking_number}`,
      'parcel',
      parcel.id,
      `Colis pour ${parcel.client_name}, montant: ${formatCurrency(parcel.total_amount)}`
    );
    navigate(`/parcels/${parcel.id}`);
  };

  const handleCreateClient = async () => {
    if (!newClient.full_name) return;
    const client = await createClient({
      ...newClient,
      notes: '',
      created_by: user?.id || '',
      created_by_name: user?.full_name || '',
    });
    setClients((prev) => [client, ...prev]);
    setForm({ ...form, client_id: client.id });
    setShowNewClient(false);
    setNewClient({ full_name: '', phone: '', whatsapp: '', city: '', address: '' });
  };

  if (loading) return <div className="animate-pulse"><div className="skeleton h-96 rounded-xl" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/parcels" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau colis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enregistrer un nouveau colis</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 dark:text-white">Client</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowNewClient(true)}>
              <UserPlus size={16} />
              Nouveau client
            </Button>
          </div>
          <Select
            label="Sélectionner un client"
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            required
          >
            <option value="">— Choisir un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} {c.phone ? `· ${c.phone}` : ''}
              </option>
            ))}
          </Select>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Informations du colis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Type de marchandise"
              placeholder="Ex: Vêtements, Électronique..."
              value={form.merchandise_type}
              onChange={(e) => setForm({ ...form, merchandise_type: e.target.value })}
            />
            <Input
              label="Nombre de colis"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value === '' ? '' : Number(e.target.value) })}
              required
            />
            <Input
              label="Poids (kg)"
              type="number"
              step="0.1"
              min={0}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value === '' ? '' : Number(e.target.value) })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Origine"
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
              />
              <Input
                label="Destination"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <Textarea
              label="Description"
              rows={2}
              placeholder="Description du contenu..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Informations financières</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Prix du transport (FCFA)"
              type="number"
              min={0}
              value={form.transport_price}
              onChange={(e) => setForm({ ...form, transport_price: e.target.value === '' ? '' : Number(e.target.value) })}
              required
            />
            <Input
              label="Frais supplémentaires (FCFA)"
              type="number"
              min={0}
              value={form.additional_fees}
              onChange={(e) => setForm({ ...form, additional_fees: e.target.value === '' ? '' : Number(e.target.value) })}
            />
            <Input
              label="Montant payé (FCFA)"
              type="number"
              min={0}
              value={form.amount_paid}
              onChange={(e) => setForm({ ...form, amount_paid: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </div>

          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Montant total</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Reste à payer</span>
              <span className={`font-bold ${balance > 0 ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-400'}`}>
                {formatCurrency(balance)}
              </span>
            </div>
          </div>
        </Card>

        <div className="flex gap-3 justify-end pb-4">
          <Link to="/parcels" className="btn-secondary">Annuler</Link>
          <Button type="submit" loading={saving}>
            <Save size={18} />
            Enregistrer le colis
          </Button>
        </div>
      </form>

      <Modal open={showNewClient} onClose={() => setShowNewClient(false)} title="Nouveau client" size="md">
        <div className="space-y-4">
          <Input
            label="Nom complet *"
            value={newClient.full_name}
            onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Téléphone"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            />
            <Input
              label="WhatsApp"
              value={newClient.whatsapp}
              onChange={(e) => setNewClient({ ...newClient, whatsapp: e.target.value })}
            />
          </div>
          <Input
            label="Ville"
            value={newClient.city}
            onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
          />
          <Input
            label="Adresse"
            value={newClient.address}
            onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowNewClient(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleCreateClient} className="btn-primary">
              <Plus size={18} />
              Créer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

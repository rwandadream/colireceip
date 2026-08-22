import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Plus,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Save,
} from 'lucide-react';
import {
  getPayments,
  getParcels,
  getParcelById,
  createPayment,
  saveAttachmentsForEntity,
  logActivity,
  getClients,
} from '../../lib/data';
import type { Attachment, Payment, Parcel, PaymentMethod, Client } from '../../lib/types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { TrackingBadge } from '../../components/ui/TrackingBadge';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AttachmentManager } from '../../components/ui/AttachmentManager';
import { formatCurrency, formatDateTime, isToday, formatTrackingNumber } from '../../lib/format';
import { generateReceiptPDF } from '../../lib/pdf';

export function PaymentsListPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await getPayments();
        setPayments(data);
      } catch (error) {
        console.error('Erreur lors du chargement des paiements:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return payments.filter((p) => {
      const paymentDate = new Date(p.payment_date);
      const matchesSearch =
        !normalizedSearch ||
        p.parcel_tracking?.toLowerCase().includes(normalizedSearch) ||
        p.client_name?.toLowerCase().includes(normalizedSearch) ||
        p.note?.toLowerCase().includes(normalizedSearch) ||
        p.recorded_by_name?.toLowerCase().includes(normalizedSearch);
      const matchesMethod = methodFilter === 'all' || p.payment_method === methodFilter;
      const matchesDate =
        dateFilter === 'all' ||
        (dateFilter === 'today' && paymentDate >= startOfDay) ||
        (dateFilter === 'week' && paymentDate >= startOfWeek) ||
        (dateFilter === 'month' && paymentDate >= startOfMonth);

      return matchesSearch && matchesMethod && matchesDate;
    });
  }, [payments, search, methodFilter, dateFilter]);

  const totalToday = payments.filter((p) => isToday(p.payment_date)).reduce((s, p) => s + p.amount, 0);
  const totalAll = payments.reduce((s, p) => s + p.amount, 0);
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Registre des Paiements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {payments.length} encaissements enregistrés au total
          </p>
        </div>
        <Link to="/payments/new" className="btn-primary">
          <Plus size={16} />
          Nouveau paiement
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Encaissé aujourd'hui" value={formatCurrency(totalToday)} icon={<Wallet size={18} />} color="success" />
        <StatCard label="Total encaissé" value={formatCurrency(totalAll)} icon={<TrendingUp size={18} />} color="brand" />
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par colis, client, note, agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="sm:w-44">
              <option value="all">Tous les modes</option>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </Select>
            <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')} className="sm:w-44">
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd’hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      {loading ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard size={32} />}
            title="Aucun paiement trouvé"
            description={search || methodFilter !== 'all' ? 'Aucun paiement ne correspond à vos critères.' : 'Enregistrez votre premier paiement.'}
            action={!search && methodFilter === 'all' ? (
              <Link to="/payments/new" className="btn-primary">
                <Plus size={16} /> Nouveau paiement
              </Link>
            ) : undefined}
          />
        </Card>
      ) : (
        <div className="data-table-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <span>{filtered.length} encaissements filtrés</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Total filtré : <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(filteredTotal)}</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Colis</th>
                  <th className="text-right">Montant</th>
                  <th>Mode</th>
                  <th>Date & Heure</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold text-slate-900 dark:text-white">{p.client_name}</td>
                    <td className="whitespace-nowrap">
                      <Link to={`/parcels/${p.parcel_id}`}>
                        <TrackingBadge tracking={p.parcel_tracking} size="sm" />
                      </Link>
                    </td>
                    <td className="text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.amount)}
                    </td>
                    <td>
                      <Badge className={PAYMENT_METHOD_COLORS[p.payment_method]}>
                        {PAYMENT_METHOD_LABELS[p.payment_method]}
                      </Badge>
                    </td>
                    <td className="text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDateTime(p.payment_date)}
                    </td>
                    <td className="text-xs text-slate-600 dark:text-slate-400">
                      {p.recorded_by_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function PaymentNewPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const parcelIdParam = searchParams.get('parcel');
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [form, setForm] = useState({
    client_id: '',
    parcel_id: parcelIdParam || '',
    amount: '' as string | number,
    payment_method: 'cash' as PaymentMethod,
    note: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [parcelsData, clientsData] = await Promise.all([getParcels(), getClients()]);
        const active = parcelsData.filter((p) => p.status !== 'cancelled' && p.balance > 0);
        setParcels(active);
        setClients(clientsData);
        if (parcelIdParam) {
          const p = await getParcelById(parcelIdParam);
          setSelectedParcel(p || null);
          if (p) setForm((f) => ({ ...f, client_id: p.client_id, parcel_id: parcelIdParam, amount: p.balance }));
        }
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : 'Erreur de chargement des données.';
        setSaveError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [parcelIdParam]);

  const handleClientSelect = async (clientId: string) => {
    const clientParcels = parcels.filter((p) => p.client_id === clientId && p.balance > 0);
    const firstParcel = clientParcels[0];
    const parcel = firstParcel ? await getParcelById(firstParcel.id) : null;
    setSelectedParcel(parcel ?? null);
    setForm((f) => ({ ...f, client_id: clientId, parcel_id: parcel?.id || '', amount: parcel?.balance || '' }));
  };

  const handleParcelSelect = async (id: string) => {
    const p = await getParcelById(id);
    setSelectedParcel(p ?? null);
    if (p) setForm((f) => ({ ...f, parcel_id: id, amount: p.balance }));
  };

  const applyQuickAmount = (mode: 'full' | 'half') => {
    if (!selectedParcel) return;
    const balance = Number(selectedParcel.balance) || 0;
    const amount = mode === 'full' ? balance : Math.round(balance / 2);
    setForm((prev) => ({ ...prev, amount: amount > 0 ? amount : '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(form.amount);
    if (!form.parcel_id || amountNum <= 0 || !selectedParcel) return;
    setSaving(true);
    setSaveError('');

    try {
      const payment = await createPayment({
        parcel_id: form.parcel_id,
        parcel_tracking: selectedParcel.tracking_number,
        client_id: selectedParcel.client_id,
        client_name: selectedParcel.client_name,
        amount: amountNum,
        payment_method: form.payment_method,
        payment_date: new Date().toISOString(),
        recorded_by: user?.id || '',
        recorded_by_name: user?.full_name || '',
        note: form.note,
      });

      setSaving(false);
      setSaved(true);
      setAttachments([]);
      setForm({ client_id: selectedParcel.client_id, parcel_id: selectedParcel.id, amount: '', payment_method: form.payment_method, note: '' });

      void (async () => {
        try {
          if (attachments.length > 0) {
            await saveAttachmentsForEntity('payment', payment.id, attachments);
          }
          await logActivity(
            user?.id || '',
            user?.full_name || '',
            `a enregistré un paiement de ${formatCurrency(amountNum)} pour le colis ${selectedParcel.tracking_number}`,
            'payment',
            payment.id,
            `Mode: ${PAYMENT_METHOD_LABELS[form.payment_method]}`
          );
        } catch (error) {
          console.error('Erreur d’enregistrement du paiement en arrière-plan', error);
        }
      })();

      setTimeout(() => {
        generateReceiptPDF(selectedParcel, [payment]);
      }, 0);
    } catch (error) {
      console.error('Erreur d’enregistrement du paiement', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to save the payment.');
      setSaving(false);
    }
  };

  const selectedClientParcels = form.client_id ? parcels.filter((p) => p.client_id === form.client_id && p.balance > 0) : [];

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/payments" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau paiement</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enregistrer un paiement</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {saved && (
          <Card className="border-success-200 bg-success-50 p-4 text-sm text-success-700 dark:border-success-900/40 dark:bg-success-950/20 dark:text-success-300">
            Paiement enregistré instantanément. Le client et le colis sont maintenant mis à jour.
          </Card>
        )}
        {saveError && (
          <Card className="border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-900/40 dark:bg-error-950/20 dark:text-error-300">
            {saveError}
          </Card>
        )}

        <Card className="p-5">
          <Select
            label="Client *"
            value={form.client_id}
            onChange={(e) => handleClientSelect(e.target.value)}
            required
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.full_name} · {client.phone || client.city}</option>
            ))}
          </Select>
        </Card>

        <Card className="p-5">
          <Select
            label="Colis *"
            value={form.parcel_id}
            onChange={(e) => handleParcelSelect(e.target.value)}
            required
            disabled={!form.client_id}
          >
            <option value="">— Sélectionner un colis —</option>
            {selectedClientParcels.map((p) => (
              <option key={p.id} value={p.id}>
                {formatTrackingNumber(p.tracking_number)} · Reste: {formatCurrency(p.balance)}
              </option>
            ))}
          </Select>
        </Card>

        {selectedParcel && (
          <Card className="p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Client</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{selectedParcel.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Montant total</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(selectedParcel.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Déjà payé</span>
                <span className="font-medium text-success-600 dark:text-success-400">{formatCurrency(selectedParcel.amount_paid)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Reste à payer</span>
                <span className="font-bold text-error-600 dark:text-error-400">{formatCurrency(selectedParcel.balance)}</span>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Input
              label="Montant (FCFA) *"
              type="number"
              min={1}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? '' : Number(e.target.value) })}
              required
            />
            {selectedParcel && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyQuickAmount('full')}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                >
                  Payer le reste
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickAmount('half')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Paiement partiel (50%)
                </button>
              </div>
            )}
          </div>
          <Select
            label="Mode de paiement *"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}
          >
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </Select>
          <Input
            label="Note (optionnel)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Pièces jointes</h2>
          <AttachmentManager
            entityType="payment"
            initialAttachments={attachments}
            onChange={setAttachments}
          />
        </Card>

        <div className="flex gap-3 justify-end pb-4">
          <Link to="/payments" className="btn-secondary">Annuler</Link>
          <Button type="submit" loading={saving}>
            <Save size={18} />
            Enregistrer maintenant
          </Button>
        </div>
      </form>
    </div>
  );
}

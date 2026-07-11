import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Plus,
  Wallet,
  TrendingUp,
  Save,
} from 'lucide-react';
import {
  getPayments,
  getParcels,
  getParcelById,
  createPayment,
  logActivity,
} from '../../lib/data';
import type { Payment, Parcel, PaymentMethod } from '../../lib/types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, formatDateTime, isToday } from '../../lib/format';
import { generateReceiptPDF } from '../../lib/pdf';

export function PaymentsListPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const data = await getPayments();
      setPayments(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        !search ||
        p.parcel_tracking?.toLowerCase().includes(search.toLowerCase()) ||
        p.client_name?.toLowerCase().includes(search.toLowerCase());
      const matchesMethod = methodFilter === 'all' || p.payment_method === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [payments, search, methodFilter]);

  const totalToday = payments.filter((p) => isToday(p.payment_date)).reduce((s, p) => s + p.amount, 0);
  const totalAll = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements"
        description={`${payments.length} paiements enregistrés`}
        actions={
          <Link to="/payments/new" className="btn-primary w-full sm:w-auto">
            <Plus size={18} />
            Nouveau paiement
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Encaissé aujourd'hui" value={formatCurrency(totalToday)} icon={<Wallet size={20} />} color="success" />
        <StatCard label="Total encaissé" value={formatCurrency(totalAll)} icon={<TrendingUp size={20} />} color="brand" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par colis, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
          <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="sm:w-48">
            <option value="all">Tous les modes</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard size={32} />}
            title="Aucun paiement trouvé"
            description={search || methodFilter !== 'all' ? 'Aucun paiement ne correspond à vos critères.' : 'Enregistrez votre premier paiement.'}
            action={!search && methodFilter === 'all' ? (
              <Link to="/payments/new" className="btn-primary">
                <Plus size={18} /> Nouveau paiement
              </Link>
            ) : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4 flex items-center gap-4 card-hover">
              <div className="w-11 h-11 rounded-xl bg-success-100 dark:bg-success-900/40 flex items-center justify-center text-success-700 dark:text-success-300 flex-shrink-0">
                <Wallet size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link to={`/parcels/${p.parcel_id}`} className="text-sm font-semibold text-slate-900 dark:text-white hover:underline">
                    {p.parcel_tracking}
                  </Link>
                  <Badge className={PAYMENT_METHOD_COLORS[p.payment_method]}>
                    {PAYMENT_METHOD_LABELS[p.payment_method]}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {p.client_name} · {formatDateTime(p.payment_date)} · {p.recorded_by_name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-success-600 dark:text-success-400">{formatCurrency(p.amount)}</p>
              </div>
            </Card>
          ))}
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [form, setForm] = useState({
    parcel_id: parcelIdParam || '',
    amount: 0,
    payment_method: 'cash' as PaymentMethod,
    note: '',
  });

  useEffect(() => {
    (async () => {
      const data = await getParcels();
      const active = data.filter((p) => p.status !== 'cancelled' && p.balance > 0);
      setParcels(active);
      if (parcelIdParam) {
        const p = await getParcelById(parcelIdParam);
        setSelectedParcel(p || null);
        if (p) setForm((f) => ({ ...f, parcel_id: parcelIdParam, amount: p.balance }));
      }
      setLoading(false);
    })();
  }, [parcelIdParam]);

  const handleParcelSelect = async (id: string) => {
    const p = await getParcelById(id);
    setSelectedParcel(p ?? null);
    if (p) setForm((f) => ({ ...f, parcel_id: id, amount: p.balance }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parcel_id || form.amount <= 0 || !selectedParcel) return;
    setSaving(true);
    const payment = await createPayment({
      parcel_id: form.parcel_id,
      parcel_tracking: selectedParcel.tracking_number,
      client_id: selectedParcel.client_id,
      client_name: selectedParcel.client_name,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      payment_date: new Date().toISOString(),
      recorded_by: user?.id || '',
      recorded_by_name: user?.full_name || '',
      note: form.note,
    });
    await logActivity(
      user?.id || '',
      user?.full_name || '',
      `a enregistré un paiement de ${formatCurrency(form.amount)} pour le colis ${selectedParcel.tracking_number}`,
      'payment',
      payment.id,
      `Mode: ${PAYMENT_METHOD_LABELS[form.payment_method]}`
    );
    generateReceiptPDF(selectedParcel, [payment]);
    window.location.href = '/payments';
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Nouveau paiement"
        description="Ajoutez un paiement pour un colis et générez un reçu instantané"
        backLink={{ to: '/payments', label: 'Retour aux paiements' }}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5">
          <Select
            label="Colis *"
            value={form.parcel_id}
            onChange={(e) => handleParcelSelect(e.target.value)}
            required
          >
            <option value="">— Sélectionner un colis —</option>
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>
                {p.tracking_number} · {p.client_name} · Reste: {formatCurrency(p.balance)}
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
          <Input
            label="Montant (FCFA) *"
            type="number"
            min={1}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            required
          />
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

        <div className="flex gap-3 justify-end pb-4">
          <Link to="/payments" className="btn-secondary">Annuler</Link>
          <Button type="submit" loading={saving}>
            <Save size={18} />
            Enregistrer & Imprimer
          </Button>
        </div>
      </form>
    </div>
  );
}

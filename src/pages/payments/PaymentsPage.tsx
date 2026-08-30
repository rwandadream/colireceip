import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Plus,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Save,
  CheckCircle2,
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
import { OfflineNotice } from '../../components/ui/OfflineNotice';
import { formatCurrency, formatDateTime, isToday, formatTrackingNumber } from '../../lib/format';
import { generateReceiptPDF } from '../../lib/pdf';
import { SubmitLock } from '../../lib/submitLock';
import { userErrorMessage } from '../../lib/userMessage';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../context/ToastContext';

export function PaymentsListPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    (async () => {
      try {
        const [paymentsData, parcelsData] = await Promise.all([getPayments(), getParcels()]);
        setPayments(paymentsData);
        setParcels(parcelsData);
      } catch (error) {
        console.error('Erreur lors du chargement des paiements:', error);
        addToast({
          type: 'error',
          title: 'Erreur de chargement',
          description: userErrorMessage(error, 'Impossible de charger les paiements. Réessayez.'),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [addToast]);

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

  // "Encaissé aujourd'hui" and "Total encaissé" must mirror getDashboardStats:
  // sums runtime payment rows PLUS the origin contribution of any "paid at
  // origin" parcel (the amount collected at creation is not a payment row).
  // Same per-role scoping as the dashboard so the figures agree there too.
  const { totalToday, totalAll } = useMemo(() => {
    const isAgent = user?.role === 'agent';
    const scopePayments = isAgent ? payments.filter((p) => p.recorded_by === user?.id) : payments;
    const scopeParcels = isAgent
      ? parcels.filter((p) => p.agent_id === user?.id || p.registered_by === user?.id)
      : parcels;
    const paymentsByParcel = new Map<string, number>();
    for (const p of scopePayments) {
      paymentsByParcel.set(p.parcel_id, (paymentsByParcel.get(p.parcel_id) || 0) + p.amount);
    }
    const originContribution = (parcel: Parcel): number =>
      Math.max((parcel.amount_paid || 0) - (paymentsByParcel.get(parcel.id) || 0), 0);
    const originToday = scopeParcels
      .filter(
        (p) => p.payment_condition === 'paid_origin' && originContribution(p) > 0 && isToday(p.received_date || p.created_at)
      )
      .reduce((sum, p) => sum + originContribution(p), 0);
    const originTotal = scopeParcels
      .filter((p) => p.payment_condition === 'paid_origin' && originContribution(p) > 0)
      .reduce((sum, p) => sum + originContribution(p), 0);
    return {
      totalToday: scopePayments.filter((p) => isToday(p.payment_date)).reduce((sum, p) => sum + p.amount, 0) + originToday,
      totalAll: scopePayments.reduce((sum, p) => sum + p.amount, 0) + originTotal,
    };
  }, [payments, parcels, user?.id, user?.role]);

  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">
            Registre des paiements
          </p>
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
  const navigate = useNavigate();
  const { state: syncState } = useSync();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const parcelIdParam = searchParams.get('parcel');
  const submitLockRef = useRef<SubmitLock | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [success, setSuccess] = useState<{ payment: Payment; parcel: Parcel; offline: boolean } | null>(null);
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
        const message = userErrorMessage(err, 'Impossible de charger les données de paiement.');
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
    if (saved || success) return;
    if (!submitLockRef.current) submitLockRef.current = new SubmitLock();
    if (!submitLockRef.current.acquire()) return;
    const amountNum = Number(form.amount);
    if (!form.parcel_id || amountNum <= 0 || !selectedParcel) {
      submitLockRef.current.release();
      return;
    }
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

      // Reflect exactly what createPayment stored locally (the previous state
      // snapshot must not be used for the success summary / receipt).
      const refreshedParcel: Parcel = {
        ...selectedParcel,
        updated_at: new Date().toISOString(),
        amount_paid: (selectedParcel.amount_paid || 0) + amountNum,
        balance: selectedParcel.payment_condition === 'paid_origin'
          ? 0
          : Math.max((selectedParcel.total_amount || 0) - ((selectedParcel.amount_paid || 0) + amountNum), 0),
      };
      setSelectedParcel(refreshedParcel);
      setSaving(false);
      setSaved(true);
      setSuccess({ payment, parcel: refreshedParcel, offline: !syncState.online });

      void (async () => {
        try {
          if (attachments.length > 0) {
            await saveAttachmentsForEntity('payment', payment.id, attachments);
          }
          await logActivity(
            user?.id || '',
            user?.full_name || '',
            `a enregistré un paiement de ${formatCurrency(amountNum)} pour le colis ${refreshedParcel.tracking_number}`,
            'payment',
            payment.id,
            `Mode: ${PAYMENT_METHOD_LABELS[form.payment_method]}`
          );
        } catch (error) {
          console.error('Erreur d’enregistrement du paiement en arrière-plan', error);
        }
      })();

      setTimeout(() => {
        void generateReceiptPDF(refreshedParcel, [payment]).catch(() => {
          addToast({
            type: 'error',
            title: 'Impression impossible',
            description: 'Le reçu du paiement n\'a pas pu être généré. Vous pouvez le réimprimer depuis la fiche colis.',
          });
        });
      }, 0);
    } catch (error) {
      console.error('Erreur d’enregistrement du paiement', error);
      setSaveError(userErrorMessage(error, 'Impossible d’enregistrer le paiement. Réessayez.'));
    } finally {
      setSaving(false);
      submitLockRef.current.release();
    }
  };

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      navigate(`/parcels/${success.payment.parcel_id}`);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [success, navigate]);

  const selectedClientParcels = form.client_id ? parcels.filter((p) => p.client_id === form.client_id && p.balance > 0) : [];

  if (loading) return <Skeleton className="h-96" />;

  if (success) {
    const fullyPaid = success.parcel.payment_condition === 'paid_origin' || success.parcel.balance <= 0;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/payments" aria-label="Retour aux paiements" className="p-2.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paiement enregistré</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Confirmation de l’encaissement</p>
          </div>
        </div>

        <Card className="border-success-200 bg-success-50 p-5 dark:border-success-900/40 dark:bg-success-950/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-success-800 dark:text-success-300">Paiement de {formatCurrency(success.payment.amount)} confirmé</p>
              <p className="text-sm text-success-700 dark:text-success-300">
                {success.offline
                  ? 'Paiement enregistré localement — synchronisation en attente de connexion.'
                  : 'Paiement enregistré — synchronisation avec le serveur en cours.'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Colis</span>
              <Link to={`/parcels/${success.payment.parcel_id}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                {formatTrackingNumber(success.parcel.tracking_number)}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Client</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{success.parcel.client_name}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Montant total</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(success.parcel.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total payé</span>
              <span className="font-semibold text-success-600 dark:text-success-400">{formatCurrency(success.parcel.amount_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Reste à payer</span>
              {success.parcel.payment_condition === 'paid_origin' ? (
                <span className="font-bold text-success-600 dark:text-success-400">Payé au départ</span>
              ) : (
                <span className={`font-bold ${fullyPaid ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                  {formatCurrency(success.parcel.balance)}
                </span>
              )}
            </div>
          </div>
        </Card>

        <div className="flex gap-3 justify-end pb-4">
          <Link to="/payments" className="btn-secondary">Retour aux paiements</Link>
          <Link to={`/parcels/${success.payment.parcel_id}`} className="btn-primary">
            Voir le colis
          </Link>
        </div>
        <p className="text-xs text-slate-400 text-right">Redirection automatique vers le colis…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <OfflineNotice />
      <div className="flex items-center gap-3">
        <Link to="/payments" aria-label="Retour aux paiements" className="p-2.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nouveau paiement</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Enregistrer un paiement</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { getParcels } from '../../lib/data';
import type { Parcel } from '../../lib/types';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS, PARCEL_STATUSES } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/Input';
import { formatCurrency, formatDate } from '../../lib/format';

export function ParcelsListPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'outstanding' | 'paid' | 'paid_origin'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'balance' | 'amount'>('recent');

  useEffect(() => {
    (async () => {
      const data = await getParcels();
      setParcels(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = parcels.filter((p) => {
      const haystack = [
        p.tracking_number,
        p.client_name,
        p.client_phone,
        p.recipient_name,
        p.recipient_phone,
        p.recipient_address,
        p.merchandise_type,
        p.description,
        p.origin,
        p.destination,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const effectiveBalance = p.payment_condition === 'paid_origin' ? 0 : p.balance;
      const matchesPayment =
        paymentFilter === 'all' ||
        (paymentFilter === 'outstanding' && effectiveBalance > 0 && p.status !== 'cancelled') ||
        (paymentFilter === 'paid' && effectiveBalance <= 0 && p.status !== 'cancelled') ||
        (paymentFilter === 'paid_origin' && p.payment_condition === 'paid_origin');

      return matchesSearch && matchesStatus && matchesPayment;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'balance') return b.balance - a.balance;
      if (sortBy === 'amount') return b.total_amount - a.total_amount;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [parcels, search, statusFilter, paymentFilter, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Colis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {parcels.length} colis au total · suivi opérationnel centralisé
          </p>
        </div>
        <Link to="/parcels/new" className="btn-primary w-full sm:w-auto">
          <Plus size={18} />
          Nouveau colis
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par numéro, client, téléphone, destinataire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
              <option value="all">Tous les statuts</option>
              {PARCEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PARCEL_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'outstanding' | 'paid' | 'paid_origin')} className="sm:w-56">
              <option value="all">Tous les paiements</option>
              <option value="outstanding">Solde ouvert</option>
              <option value="paid">Payé</option>
              <option value="paid_origin">Payé au départ</option>
            </Select>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recent' | 'balance' | 'amount')} className="sm:w-48">
              <option value="recent">Plus récents</option>
              <option value="balance">Plus de solde</option>
              <option value="amount">Plus de montant</option>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={32} />}
            title="Aucun colis trouvé"
            description={search || statusFilter !== 'all' ? 'Aucun colis ne correspond à vos critères de recherche.' : 'Commencez par enregistrer votre premier colis.'}
            action={
              !search && statusFilter === 'all' ? (
                <Link to="/parcels/new" className="btn-primary">
                  <Plus size={18} />
                  Nouveau colis
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/70">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">N° colis</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Trajet</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Solde</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((parcel) => (
                  <tr key={parcel.id} className="border-t border-slate-100 dark:border-slate-700/60">
                    <td className="px-4 py-3">
                      <Link to={`/parcels/${parcel.id}`} className="font-semibold text-brand-600 hover:underline">
                        {parcel.tracking_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <UserIcon size={14} className="text-slate-400" />
                        <span>{parcel.client_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{parcel.origin} → {parcel.destination}</td>
                    <td className="px-4 py-3"><Badge className={PARCEL_STATUS_COLORS[parcel.status]}>{PARCEL_STATUS_LABELS[parcel.status]}</Badge></td>
                    <td className="px-4 py-3">
                      {parcel.payment_condition === 'paid_origin' ? (
                        <Badge className="bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300">Payé au départ</Badge>
                      ) : parcel.balance > 0 && parcel.status !== 'cancelled' ? (
                        <span className="font-semibold text-error-600 dark:text-error-400">{formatCurrency(parcel.balance)}</span>
                      ) : parcel.status !== 'cancelled' ? (
                        <Badge className="bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300">Payé</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

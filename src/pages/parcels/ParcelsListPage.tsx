import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  User as UserIcon,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { getParcels } from '../../lib/data';
import type { Parcel } from '../../lib/types';
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS, PARCEL_STATUSES } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { TrackingBadge } from '../../components/ui/TrackingBadge';
import { formatCurrency } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export function ParcelsListPage() {
  const { addToast } = useToast();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'outstanding' | 'paid' | 'paid_origin'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'balance' | 'amount'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await getParcels();
        setParcels(data);
      } catch (err) {
        setLoadError(true);
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Impossible de charger la liste des colis.';
        addToast({ type: 'error', title: 'Erreur', description: message });
      } finally {
        setLoading(false);
      }
    })();
  }, [addToast, refreshKey]);

  const handleRetry = () => setRefreshKey((k) => k + 1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, paymentFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedParcels = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-0.5">
            Registre des colis
          </p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Registre des Colis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {parcels.length} colis au total · suivi opérationnel centralisé
          </p>
        </div>
        <Link to="/parcels/new" className="btn-primary">
          <Plus size={16} />
          Nouveau colis
        </Link>
      </div>

      {/* Toolbar Filters */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Rechercher par numéro, client, téléphone, destinataire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              {PARCEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PARCEL_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(
                  e.target.value as 'all' | 'outstanding' | 'paid' | 'paid_origin'
                )
              }
            >
              <option value="all">Tous les paiements</option>
              <option value="outstanding">Solde ouvert</option>
              <option value="paid">Payé</option>
              <option value="paid_origin">Payé au départ</option>
            </Select>
            <Select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'recent' | 'balance' | 'amount')
              }
              className="col-span-2 sm:col-span-1"
            >
              <option value="recent">Plus récents</option>
              <option value="balance">Plus de solde</option>
              <option value="amount">Plus de montant</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      {loading ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : loadError ? (
        <Card className="p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-error-500 mb-2" />
          <p className="text-sm font-semibold text-error-600 dark:text-error-400 mb-1">Impossible de charger les colis</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Une erreur est survenue lors du chargement des données. Vérifiez votre connexion puis réessayez.</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>Réessayer</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={32} />}
            title="Aucun colis trouvé"
            description={
              search || statusFilter !== 'all'
                ? 'Aucun colis ne correspond à vos critères de recherche.'
                : 'Commencez par enregistrer votre premier colis.'
            }
            action={
              !search && statusFilter === 'all' ? (
                <Link to="/parcels/new" className="btn-primary">
                  <Plus size={16} />
                  Nouveau colis
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
        <div className="data-table-container">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>N° Colis</th>
                  <th>Client</th>
                  <th>Trajet</th>
                  <th>Statut</th>
                  <th className="text-right">Montant</th>
                  <th className="text-right">Solde / Statut</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedParcels.map((parcel) => (
                  <tr key={parcel.id}>
                    <td className="font-semibold whitespace-nowrap">
                      <Link to={`/parcels/${parcel.id}`}>
                        <TrackingBadge tracking={parcel.tracking_number} size="sm" />
                      </Link>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                        <UserIcon size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate min-w-0">{parcel.client_name}</span>
                      </div>
                      {parcel.client_phone && (
                        <p className="text-[11px] text-slate-400 pl-4">{parcel.client_phone}</p>
                      )}
                    </td>
                    <td className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {parcel.origin} <span className="text-slate-400 font-normal">➔</span>{' '}
                      {parcel.destination}
                    </td>
                    <td>
                      <Badge className={PARCEL_STATUS_COLORS[parcel.status]}>
                        {PARCEL_STATUS_LABELS[parcel.status]}
                      </Badge>
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatCurrency(parcel.total_amount)}
                    </td>
                    <td className="text-right tabular-nums">
                      {parcel.payment_condition === 'paid_origin' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Payé au départ
                        </Badge>
                      ) : parcel.balance > 0 && parcel.status !== 'cancelled' ? (
                        <span className="font-bold text-error-600 dark:text-error-400">
                          Reste: {formatCurrency(parcel.balance)}
                        </span>
                      ) : parcel.status !== 'cancelled' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Payé
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/parcels/${parcel.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-md transition-colors"
                      >
                        Voir
                        <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          currentPage={safePage}
          totalItems={filtered.length}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={setPerPage}
        />
        </>
      )}
    </div>
  );
}
